import unreal


MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
MODE = "/Game/BLA/Blueprints/Core/BP_BLAGameMode_Elimination"
CONFIG_BLUEPRINT = "/Game/BLA/Blueprints/Maps/BP_BLAMapConfig"
ZONE_BLUEPRINT = "/Game/BLA/Blueprints/Maps/BP_BLAMapZone"
CONFIG_ASSET = "/Game/BLA/Data/Maps/DA_BLAMapConfig_ZeroFacility"
CORE_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLADataCore"
ZONE_OBJECTIVE_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLAObjectiveZone"
MANAGER_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLAObjectiveManager"
TEST_BLUEPRINT = "/Game/BLA/Tests/FT_BLA_MapNavigation"

TASK11_LABELS = {
    "Zero Facility Floor",
    "BLA Map Config",
    "BLA Map Navigation Test",
    "Data Core",
    "Data Core Objective Zone",
    "BLA Objective Manager",
    "Data Core Plant Point",
    "Data Core Defuse Point",
    "Zero Facility Navigation Bounds",
}

# zone type, name, location, extent
ZONES = [
    (unreal.BLA_MapZoneType.ATTACK_SPAWN, "AttackSpawn", (-1200.0, 0.0, 150.0), (240.0, 700.0, 250.0)),
    (unreal.BLA_MapZoneType.LEFT_ROUTE, "LeftRoute", (-600.0, -600.0, 150.0), (420.0, 230.0, 250.0)),
    (unreal.BLA_MapZoneType.CENTER_ROUTE, "CenterRoute", (-600.0, 0.0, 150.0), (420.0, 230.0, 250.0)),
    (unreal.BLA_MapZoneType.RIGHT_ROUTE, "RightRoute", (-600.0, 600.0, 150.0), (420.0, 230.0, 250.0)),
    (unreal.BLA_MapZoneType.MID_COMBAT_ZONE, "MidCombatZone", (0.0, 0.0, 150.0), (360.0, 800.0, 250.0)),
    (unreal.BLA_MapZoneType.OBJECTIVE_ZONE, "ObjectiveZone", (600.0, 0.0, 150.0), (360.0, 500.0, 250.0)),
    (unreal.BLA_MapZoneType.FLANK_ZONE, "FlankZone", (600.0, -760.0, 150.0), (460.0, 180.0, 250.0)),
    (unreal.BLA_MapZoneType.DEFENSE_SPAWN, "DefenseSpawn", (1200.0, 0.0, 150.0), (240.0, 700.0, 250.0)),
]

# label, location, scale (cube 100 units -> 1m per scale unit)
BLOCKS = [
    ("Zero Facility Floor", (0.0, 0.0, -20.0), (32.0, 20.0, 0.4)),
    ("North Wall", (0.0, 1000.0, 200.0), (32.0, 0.4, 4.0)),
    ("South Wall", (0.0, -1000.0, 200.0), (32.0, 0.4, 4.0)),
    ("West Wall", (-1600.0, 0.0, 200.0), (0.4, 20.0, 4.0)),
    ("East Wall", (1600.0, 0.0, 200.0), (0.4, 20.0, 4.0)),
    # Mid wall: three 260-wide route entries at the corridor centres.
    ("Mid Wall North", (-200.0, 865.0, 200.0), (0.4, 2.7, 4.0)),
    ("Mid Wall Center North", (-200.0, 300.0, 200.0), (0.4, 3.4, 4.0)),
    ("Mid Wall Center South", (-200.0, -300.0, 200.0), (0.4, 3.4, 4.0)),
    ("Mid Wall South", (-200.0, -865.0, 200.0), (0.4, 2.7, 4.0)),
    # Staggered corridor blockers so no straight spawn-to-spawn line survives.
    ("Left Corridor Blocker", (-800.0, -790.0, 150.0), (0.4, 0.9, 3.0)),
    ("Left Corridor Blocker 2", (-400.0, -490.0, 150.0), (0.4, 0.9, 3.0)),
    ("Center Corridor Blocker", (-800.0, 0.0, 150.0), (0.4, 0.9, 3.0)),
    ("Right Corridor Blocker", (-800.0, 790.0, 150.0), (0.4, 0.9, 3.0)),
    ("Right Corridor Blocker 2", (-400.0, 490.0, 150.0), (0.4, 0.9, 3.0)),
    # Mid combat cover: low, high and directional pieces.
    ("Mid Low Cover", (-80.0, -350.0, 45.0), (1.6, 0.8, 0.9)),
    ("Mid High Cover", (40.0, 260.0, 110.0), (1.2, 1.2, 2.2)),
    ("Mid Directional Cover", (-100.0, 620.0, 90.0), (3.0, 0.4, 1.8)),
    ("Mid Center Pillar", (150.0, 0.0, 125.0), (0.8, 0.8, 2.5)),
    # Objective area: two target entries plus the flank entrance, everything else solid.
    ("Objective Wall North", (300.0, 950.0, 200.0), (0.4, 1.0, 4.0)),
    ("Objective Wall North 2", (300.0, 700.0, 200.0), (0.4, 2.0, 4.0)),
    ("Objective Wall North Entry", (300.0, 470.0, 200.0), (0.4, 1.9, 4.0)),
    ("Objective Wall Center", (300.0, 0.0, 200.0), (0.4, 2.6, 4.0)),
    ("Objective Wall South Entry", (300.0, -500.0, 200.0), (0.4, 2.0, 4.0)),
    ("Objective Wall South", (300.0, -980.0, 200.0), (0.4, 0.4, 4.0)),
    ("Objective High Cover", (520.0, -320.0, 110.0), (1.0, 1.0, 2.2)),
    ("Objective Low Cover", (760.0, 300.0, 45.0), (1.6, 0.8, 0.9)),
    # Flank corridor.
    ("Flank Wall North", (600.0, -580.0, 200.0), (9.0, 0.4, 4.0)),
    ("Flank Wall South", (600.0, -940.0, 200.0), (9.0, 0.4, 4.0)),
]

SPAWNS = [
    ("Attacker Protected Spawn", unreal.BLA_Team.ATTACKERS, (-1320.0, -500.0, 120.0), "AttackSpawn"),
    ("Attacker Spawn 2", unreal.BLA_Team.ATTACKERS, (-1320.0, 0.0, 120.0), "AttackSpawn"),
    ("Attacker Spawn 3", unreal.BLA_Team.ATTACKERS, (-1320.0, 500.0, 120.0), "AttackSpawn"),
    ("Defender Protected Spawn", unreal.BLA_Team.DEFENDERS, (1320.0, -500.0, 120.0), "DefenseSpawn"),
    ("Defender Spawn 2", unreal.BLA_Team.DEFENDERS, (1320.0, 0.0, 120.0), "DefenseSpawn"),
    ("Defender Spawn 3", unreal.BLA_Team.DEFENDERS, (1320.0, 500.0, 120.0), "DefenseSpawn"),
]

TACTICAL = [
    ("Attack Route Point", unreal.BLA_TacticalPointType.ATTACK_POINT, unreal.BLA_BotRole.ASSAULT, (-300.0, 0.0, 100.0)),
    ("Flank Point", unreal.BLA_TacticalPointType.FLANK_POINT, unreal.BLA_BotRole.ASSAULT, (-200.0, -760.0, 100.0)),
    ("Cover Point", unreal.BLA_TacticalPointType.COVER_POINT, unreal.BLA_BotRole.SUPPORT, (-700.0, 600.0, 100.0)),
    ("Guard Point", unreal.BLA_TacticalPointType.GUARD_POINT, unreal.BLA_BotRole.DEFENDER, (800.0, 400.0, 100.0)),
    ("Retreat Point", unreal.BLA_TacticalPointType.RETREAT_POINT, unreal.BLA_BotRole.SUPPORT, (1000.0, -600.0, 100.0)),
    ("Data Core Plant Point", unreal.BLA_TacticalPointType.PLANT_POINT, unreal.BLA_BotRole.ASSAULT, (450.0, -150.0, 100.0)),
    ("Data Core Defuse Point", unreal.BLA_TacticalPointType.DEFUSE_POINT, unreal.BLA_BotRole.DEFENDER, (750.0, 150.0, 100.0)),
]

OWNED_LABELS = (
    {label for label, _, _ in BLOCKS}
    | {f"Zone {name}" for _, name, _, _ in ZONES}
    | {label for label, _, _, _ in SPAWNS}
    | {label for label, _, _, _ in TACTICAL}
    | TASK11_LABELS
    | {"Facility Light West", "Facility Light Mid", "Facility Light East"}
)

assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
state = {"ticks": 0, "built": False, "finished": False, "save_attempts": 0, "next_build_tick": 60, "recast_configured": False}
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


def spawn_block(label, location, scale):
    mesh = unreal.load_asset("/Engine/BasicShapes/Cube.Cube")
    actor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(*location), unreal.Rotator())
    if actor is None:
        raise RuntimeError(f"Failed to spawn {label}")
    actor.set_actor_label(label)
    actor.set_editor_property("tags", ["BLAZeroFacility"])
    actor.static_mesh_component.set_static_mesh(mesh)
    actor.set_actor_scale3d(unreal.Vector(*scale))
    return actor


def spawn_zone(zone_blueprint, zone_type, name, location, extent):
    zone = actors.spawn_actor_from_class(zone_blueprint.generated_class(), unreal.Vector(*location), unreal.Rotator())
    if zone is None:
        raise RuntimeError(f"Failed to place zone {name}")
    zone.set_actor_label(f"Zone {name}")
    zone.set_editor_properties({
        "zone_type": zone_type,
        "zone_name": name,
        "zone_extent": unreal.Vector(*extent),
        "tags": ["BLAZeroFacility"],
    })
    return zone


def spawn_point(label, team, location, zone_name):
    point = actors.spawn_actor_from_class(unreal.BLASpawnPoint, unreal.Vector(*location), unreal.Rotator(0, 180 if team == unreal.BLA_Team.DEFENDERS else 0, 0))
    if point is None:
        raise RuntimeError(f"Failed to place spawn {label}")
    point.set_actor_label(label)
    point.set_editor_properties({"team": team, "zone": zone_name, "tags": ["BLAZeroFacility"]})
    return point


def spawn_tactical(label, point_type, role, location):
    point = actors.spawn_actor_from_class(unreal.BLATacticalPoint, unreal.Vector(*location), unreal.Rotator())
    if point is None:
        raise RuntimeError(f"Failed to place {label}")
    point.set_actor_label(label)
    point.set_editor_properties({
        "point_type": point_type,
        "team": unreal.BLA_Team.NEUTRAL,
        "preferred_role": role,
        "priority": 2.0,
        "is_objective_point": point_type in (unreal.BLA_TacticalPointType.PLANT_POINT, unreal.BLA_TacticalPointType.DEFUSE_POINT),
        "tags": ["BLAZeroFacility"],
    })
    return point


def build_config_asset():
    asset = unreal.load_asset(CONFIG_ASSET)
    if asset is None:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.BLAMapConfigDataAsset)
        asset = unreal.AssetToolsHelpers.get_asset_tools().create_asset("DA_BLAMapConfig_ZeroFacility", "/Game/BLA/Data/Maps", unreal.BLAMapConfigDataAsset, factory)
    if asset is None:
        raise RuntimeError("Failed to create DA_BLAMapConfig_ZeroFacility")
    asset.set_editor_properties({
        "map_id": "ZeroFacility",
        "supported_modes": [unreal.BLA_MatchMode.TEAM_ELIMINATION, unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE],
        "supported_team_sizes": [1, 2, 3],
        "spawn_points_per_team": 3,
        "cover_pieces": 12,
        "route_names": ["LeftRoute", "CenterRoute", "RightRoute", "FlankZone"],
        "supports_objective": True,
    })
    save(asset)
    return asset


def build_map(mode_blueprint, zone_blueprint, config_blueprint, config_asset, core_blueprint, objective_zone_blueprint, manager_blueprint, test_blueprint):
    if not assets.does_asset_exist(MAP):
        if not levels.new_level(MAP):
            raise RuntimeError(f"Failed to create {MAP}")
    if not levels.load_level(MAP):
        raise RuntimeError(f"Failed to load {MAP}")

    for actor in actors.get_all_level_actors():
        label = actor.get_actor_label()
        if actor.actor_has_tag("BLAZeroFacility") or label in OWNED_LABELS or label.startswith("Facility Light"):
            actors.destroy_actor(actor)

    for label, location, scale in BLOCKS:
        spawn_block(label, location, scale)

    zone_actors = [spawn_zone(zone_blueprint, zone_type, name, location, extent) for zone_type, name, location, extent in ZONES]
    for label, team, location, zone_name in SPAWNS:
        spawn_point(label, team, location, zone_name)
    for label, point_type, role, location in TACTICAL:
        spawn_tactical(label, point_type, role, location)

    core = actors.spawn_actor_from_class(core_blueprint.generated_class(), unreal.Vector(600.0, 0.0, 150.0), unreal.Rotator())
    if core is None:
        raise RuntimeError("Failed to place the data core")
    core.set_actor_label("Data Core")
    core.set_editor_property("tags", ["BLAObjectiveCore", "BLAZeroFacility"])

    objective_zone = actors.spawn_actor_from_class(objective_zone_blueprint.generated_class(), unreal.Vector(600.0, 0.0, 150.0), unreal.Rotator())
    if objective_zone is None:
        raise RuntimeError("Failed to place the objective zone")
    objective_zone.set_actor_label("Data Core Objective Zone")
    objective_zone.set_editor_properties({
        "tags": ["BLAObjectiveZone", "BLAZeroFacility"],
        "zone_extent": unreal.Vector(360.0, 500.0, 250.0),
    })

    manager = actors.spawn_actor_from_class(manager_blueprint.generated_class(), unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator())
    if manager is None:
        raise RuntimeError("Failed to place the objective manager")
    manager.set_actor_label("BLA Objective Manager")
    manager.set_editor_properties({
        "tags": ["BLALevelObjectiveManager", "BLAZeroFacility"],
        "data_core": core,
        "objective_zone": objective_zone,
    })

    nav = actors.spawn_actor_from_class(unreal.NavMeshBoundsVolume, unreal.Vector(0.0, 0.0, 180.0), unreal.Rotator())
    if nav is None:
        raise RuntimeError("Failed to place navigation bounds")
    nav.set_actor_label("Zero Facility Navigation Bounds")
    nav.set_editor_property("tags", ["BLAZeroFacility"])
    nav.set_actor_scale3d(unreal.Vector(16.0, 10.0, 2.0))

    config_actor = actors.spawn_actor_from_class(config_blueprint.generated_class(), unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator())
    if config_actor is None:
        raise RuntimeError("Failed to place the map config")
    config_actor.set_actor_label("BLA Map Config")
    config_actor.set_editor_properties({
        "tags": ["BLAZeroFacility"],
        "config": config_asset,
        "zones": zone_actors,
        "objective_manager": manager,
        "data_core": core,
        "objective_zone": objective_zone,
    })

    test_actor = actors.spawn_actor_from_class(test_blueprint.generated_class(), unreal.Vector(0.0, 0.0, 700.0), unreal.Rotator())
    if test_actor is None:
        raise RuntimeError("Failed to place the navigation test")
    test_actor.set_actor_label("BLA Map Navigation Test")
    test_actor.set_editor_property("tags", ["BLAZeroFacility"])

    for label, location in [("Facility Light West", (-900.0, 0.0, 500.0)), ("Facility Light Mid", (0.0, 0.0, 500.0)), ("Facility Light East", (900.0, 0.0, 500.0))]:
        light = actors.spawn_actor_from_class(unreal.PointLight, unreal.Vector(*location), unreal.Rotator())
        light.set_actor_label(label)
        light.set_editor_property("tags", ["BLAZeroFacility"])
        light.point_light_component.set_editor_property("intensity", 12000.0)
        light.point_light_component.set_editor_property("attenuation_radius", 2600.0)

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    world.get_world_settings().set_editor_property("default_game_mode", mode_blueprint.generated_class())


def tick(_):
    state["ticks"] += 1
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not state["built"] and state["ticks"] >= state["next_build_tick"]:
        unreal.SystemLibrary.execute_console_command(world, "RebuildNavigation")
        path = unreal.NavigationSystemV1.find_path_to_location_synchronously(
            world, unreal.Vector(-1300.0, -500.0, 20.0), unreal.Vector(1300.0, 500.0, 20.0))
        path_points = path.get_editor_property("path_points") if path else []
        state["built"] = bool(path and path.is_valid() and len(path_points) >= 2)
        state["next_build_tick"] += 60
        unreal.log(f"BLA_TASK11_NAVIGATION_BUILD_ATTEMPT reachable={int(state['built'])}")
    if not state["built"] and state["ticks"] >= 900:
        unreal.log_error("BLA_TASK11_ASSET_BUILD_FAILED reason=navigation")
        state["finished"] = True
        unreal.unregister_slate_post_tick_callback(callback_handle)
        unreal.SystemLibrary.quit_editor()
        return
    if state["built"] and not state["finished"]:
        if not state["recast_configured"]:
            for actor in actors.get_all_level_actors():
                if isinstance(actor, unreal.RecastNavMesh):
                    actor.set_editor_property("runtime_generation", unreal.RuntimeGenerationType.DYNAMIC)
                    state["recast_configured"] = True
            unreal.log(f"BLA_TASK11_RECAST_RUNTIME_DYNAMIC configured={int(state['recast_configured'])}")
        if not levels.save_current_level():
            state["save_attempts"] += 1
            if state["save_attempts"] >= 120:
                unreal.log_error(f"BLA_TASK11_ASSET_BUILD_FAILED reason=save map={MAP}")
                state["finished"] = True
                unreal.unregister_slate_post_tick_callback(callback_handle)
                unreal.SystemLibrary.quit_editor()
            return
        state["finished"] = True
        unreal.log("BLA_TASK11_ASSETS_BUILT map=1 zones=8 spawns=6 tactical=7 cover=12 config=1 objective=1 navigation_test=1")
        unreal.unregister_slate_post_tick_callback(callback_handle)
        unreal.SystemLibrary.quit_editor()


def main():
    global callback_handle
    mode = blueprint(MODE, unreal.BLAGameModeElimination)
    zone_blueprint = blueprint(ZONE_BLUEPRINT, unreal.BLAMapZone)
    config_blueprint = blueprint(CONFIG_BLUEPRINT, unreal.BLAMapConfig)
    test = blueprint(TEST_BLUEPRINT, unreal.BLAMapNavigationTest)
    config_asset = build_config_asset()
    build_map(mode, zone_blueprint, config_blueprint, config_asset,
              unreal.load_asset(CORE_BLUEPRINT), unreal.load_asset(ZONE_OBJECTIVE_BLUEPRINT),
              unreal.load_asset(MANAGER_BLUEPRINT), test)
    callback_handle = unreal.register_slate_post_tick_callback(tick)
    unreal.log("BLA_TASK11_ASSET_BUILD_WAITING_FOR_NAVIGATION")


main()
