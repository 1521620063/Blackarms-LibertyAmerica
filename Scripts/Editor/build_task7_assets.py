import unreal


MAP = "/Game/FPS/Maps/Graybox/L_FPS_1v1_Elimination"
MODE = "/Game/FPS/Blueprints/Core/BP_FPSGameMode_Elimination"
TEST = "/Game/FPS/Tests/FT_FPS_1v1_Elimination"

assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
state = {"ticks": 0, "built": False, "finished": False, "save_attempts": 0, "next_build_tick": 60}
callback_handle = None


def save(asset):
    if not assets.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")


def blueprint(path, parent):
    result = unreal.load_asset(path) if assets.does_asset_exist(path) else unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(path, parent)
    if result is None:
        raise RuntimeError(f"Failed to create {path}")
    unreal.BlueprintEditorLibrary.compile_blueprint(result)
    save(result)
    return result


def spawn_cube(label, location, scale):
    mesh = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
    actor = actors.spawn_actor_from_class(unreal.StaticMeshActor, location, unreal.Rotator())
    if actor is None:
        raise RuntimeError(f"Failed to spawn {label}")
    actor.set_actor_label(label)
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.set_actor_scale3d(scale)
    return actor


def spawn_light(label, location, intensity, radius):
    light = actors.spawn_actor_from_class(unreal.PointLight, location, unreal.Rotator())
    if light is None:
        raise RuntimeError(f"Failed to spawn {label}")
    light.set_actor_label(label)
    light.point_light_component.set_editor_property("intensity", intensity)
    light.point_light_component.set_editor_property("attenuation_radius", radius)


def build_map(mode_blueprint, test_blueprint):
    if not assets.does_asset_exist(MAP):
        if not levels.new_level(MAP):
            raise RuntimeError(f"Failed to create {MAP}")
    if not levels.load_level(MAP):
        raise RuntimeError(f"Failed to load {MAP}")

    for actor in actors.get_all_level_actors():
        actors.destroy_actor(actor)

    spawn_cube("Arena Floor", unreal.Vector(0, 0, -20), unreal.Vector(24, 16, 0.4))
    spawn_cube("North Wall", unreal.Vector(0, 800, 200), unreal.Vector(24, 0.4, 4))
    spawn_cube("South Wall", unreal.Vector(0, -800, 200), unreal.Vector(24, 0.4, 4))
    spawn_cube("West Wall", unreal.Vector(-1200, 0, 200), unreal.Vector(0.4, 16, 4))
    spawn_cube("East Wall", unreal.Vector(1200, 0, 200), unreal.Vector(0.4, 16, 4))

    spawn_cube("Attacker Spawn Shield", unreal.Vector(-850, 0, 110), unreal.Vector(0.4, 7, 2.2))
    spawn_cube("Defender Spawn Shield", unreal.Vector(850, 0, 110), unreal.Vector(0.4, 7, 2.2))
    spawn_cube("Cover Left", unreal.Vector(-250, -330, 90), unreal.Vector(2.4, 1.0, 1.8))
    spawn_cube("Cover Center", unreal.Vector(0, 0, 90), unreal.Vector(1.4, 3.0, 1.8))
    spawn_cube("Cover Right", unreal.Vector(250, 330, 90), unreal.Vector(2.4, 1.0, 1.8))

    attacker = actors.spawn_actor_from_class(unreal.FPSSpawnPoint, unreal.Vector(-1020, -350, 120), unreal.Rotator(0, 0, 0))
    defender = actors.spawn_actor_from_class(unreal.FPSSpawnPoint, unreal.Vector(1020, 350, 120), unreal.Rotator(0, 180, 0))
    if attacker is None or defender is None:
        raise RuntimeError("Failed to create team spawn points")
    attacker.set_actor_label("Attacker Protected Spawn")
    attacker.set_editor_properties({"team": unreal.FPS_Team.ATTACKERS, "zone": "AttackSpawn"})
    defender.set_actor_label("Defender Protected Spawn")
    defender.set_editor_properties({"team": unreal.FPS_Team.DEFENDERS, "zone": "DefenseSpawn"})

    nav = actors.spawn_actor_from_class(unreal.NavMeshBoundsVolume, unreal.Vector(0, 0, 180), unreal.Rotator())
    if nav is None:
        raise RuntimeError("Failed to create navigation bounds")
    nav.set_actor_label("1v1 Arena Navigation Bounds")
    nav.set_actor_scale3d(unreal.Vector(12, 8, 2))

    test_actor = actors.spawn_actor_from_class(test_blueprint.generated_class(), unreal.Vector(0, 0, 600), unreal.Rotator())
    if test_actor is None:
        raise RuntimeError("Failed to place elimination functional test")
    test_actor.set_actor_label("FPS 1v1 Elimination Functional Test")

    spawn_light("Arena Light West", unreal.Vector(-500, 0, 450), 8000.0, 1500.0)
    spawn_light("Arena Light East", unreal.Vector(500, 0, 450), 8000.0, 1500.0)

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    world.get_world_settings().set_editor_property("default_game_mode", mode_blueprint.generated_class())


def tick(_):
    state["ticks"] += 1
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not state["built"] and state["ticks"] >= state["next_build_tick"]:
        unreal.SystemLibrary.execute_console_command(world, "RebuildNavigation")
        path = unreal.NavigationSystemV1.find_path_to_location_synchronously(
            world, unreal.Vector(-1000, -600, 20), unreal.Vector(1000, 600, 20))
        path_points = path.get_editor_property("path_points") if path else []
        state["built"] = bool(path and path.is_valid() and len(path_points) >= 2)
        state["next_build_tick"] += 60
        unreal.log(f"FPS_TASK7_NAVIGATION_BUILD_ATTEMPT reachable={int(state['built'])}")
    if not state["built"] and state["ticks"] >= 600:
        unreal.log_error("FPS_TASK7_ASSET_BUILD_FAILED reason=navigation")
        state["finished"] = True
        unreal.unregister_slate_post_tick_callback(callback_handle)
        unreal.SystemLibrary.quit_editor()
        return
    if state["built"] and not state["finished"]:
        if not levels.save_current_level():
            state["save_attempts"] += 1
            if state["save_attempts"] >= 120:
                unreal.log_error(f"FPS_TASK7_ASSET_BUILD_FAILED reason=save map={MAP}")
                state["finished"] = True
                unreal.unregister_slate_post_tick_callback(callback_handle)
                unreal.SystemLibrary.quit_editor()
            return
        state["finished"] = True
        unreal.log("FPS_TASK7_ASSETS_BUILT map=1 room=1 protected_spawns=2 cover=3 navmesh=1 game_modes=1 functional_tests=1")
        unreal.unregister_slate_post_tick_callback(callback_handle)
        unreal.SystemLibrary.quit_editor()


def main():
    global callback_handle
    mode = blueprint(MODE, unreal.FPSGameModeElimination)
    test = blueprint(TEST, unreal.FPS1v1EliminationTest)
    build_map(mode, test)
    callback_handle = unreal.register_slate_post_tick_callback(tick)
    unreal.log("FPS_TASK7_ASSET_BUILD_WAITING_FOR_NAVIGATION")


main()
