import unreal


MAP = "/Game/FPS/Maps/Graybox/L_FPS_1v1_Elimination"
assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


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


def spawn_point(label, team, location, rotation, zone):
    point = actors.spawn_actor_from_class(unreal.FPSSpawnPoint, location, rotation)
    if point is None:
        raise RuntimeError(f"Failed to create {label}")
    point.set_actor_label(label)
    point.set_editor_properties({"team": team, "zone": zone})


def tactical_point(label, point_type, role, location):
    point = actors.spawn_actor_from_class(unreal.FPSTacticalPoint, location, unreal.Rotator())
    if point is None:
        raise RuntimeError(f"Failed to create {label}")
    point.set_actor_label(label)
    point.set_editor_properties({
        "point_type": point_type,
        "team": unreal.FPS_Team.NEUTRAL,
        "preferred_role": role,
        "priority": 2.0,
    })


def main():
    order_manager = blueprint("/Game/FPS/Blueprints/Teams/BP_FPSTeamOrderManager", unreal.FPSTeamOrderManager)
    role_assignment = blueprint("/Game/FPS/Blueprints/Teams/BP_FPSRoleAssignment", unreal.FPSRoleAssignment)
    follow = blueprint("/Game/FPS/AI/Tasks/BTT_FPSFollowPlayer", unreal.BTTask_BlueprintBase)
    guard = blueprint("/Game/FPS/AI/Tasks/BTT_FPSGuardPoint", unreal.BTTask_BlueprintBase)
    attack = blueprint("/Game/FPS/AI/Tasks/BTT_FPSAttackRoute", unreal.BTTask_BlueprintBase)
    blueprint("/Game/FPS/Blueprints/UI/WBP_FPSSpectator", unreal.UserWidget)
    test = blueprint("/Game/FPS/Tests/FT_FPS_3v3_Elimination", unreal.FPS3v3EliminationTest)

    tree = unreal.load_asset("/Game/FPS/AI/BehaviorTrees/BT_FPSBotElimination")
    blackboard = unreal.load_asset("/Game/FPS/AI/Blackboards/BB_FPSBot")
    base_tasks = [
        unreal.load_asset("/Game/FPS/AI/Tasks/BTT_FPSAimAndFire"),
        unreal.load_asset("/Game/FPS/AI/Tasks/BTT_FPSFindCover"),
        unreal.load_asset("/Game/FPS/AI/Tasks/BTT_FPSSearchLastKnownPosition"),
        unreal.load_asset("/Game/FPS/AI/Tasks/BTT_FPSMoveToTacticalPoint"),
    ]
    services = [
        unreal.load_asset("/Game/FPS/AI/Services/BTS_FPSUpdateTarget"),
        unreal.load_asset("/Game/FPS/AI/Services/BTS_FPSCheckStuck"),
    ]
    if not unreal.FPSBlueprintAssetBuilder.configure_fps_bot_team_behavior_tree(
        tree, blackboard,
        [task.generated_class() for task in base_tasks],
        [follow.generated_class(), guard.generated_class(), attack.generated_class()],
        [service.generated_class() for service in services],
    ):
        raise RuntimeError("Failed to configure Task 8 elimination behavior tree")
    save(tree)

    if not levels.load_level(MAP):
        raise RuntimeError(f"Failed to load {MAP}")
    for actor in actors.get_all_level_actors():
        if isinstance(actor, unreal.FPSSpawnPoint) or isinstance(actor, unreal.FPSTacticalPoint):
            actors.destroy_actor(actor)
        elif actor.get_actor_label() == "FPS 3v3 Elimination Functional Test":
            actors.destroy_actor(actor)
        elif isinstance(actor, unreal.CameraActor) and actor.actor_has_tag("FixedSpectatorCamera"):
            actors.destroy_actor(actor)

    for index, y in enumerate((-500.0, 0.0, 500.0), start=1):
        attacker_label = "Attacker Protected Spawn" if index == 1 else f"Attacker Spawn {index}"
        defender_label = "Defender Protected Spawn" if index == 1 else f"Defender Spawn {index}"
        spawn_point(attacker_label, unreal.FPS_Team.ATTACKERS,
                    unreal.Vector(-1020, y, 120), unreal.Rotator(0, 0, 0), "AttackSpawn")
        spawn_point(defender_label, unreal.FPS_Team.DEFENDERS,
                    unreal.Vector(1020, -y, 120), unreal.Rotator(0, 180, 0), "DefenseSpawn")

    tactical_point("Attack Route Point", unreal.FPS_TacticalPointType.ATTACK_POINT,
                   unreal.FPS_BotRole.ASSAULT, unreal.Vector(300, -400, 100))
    tactical_point("Guard Point", unreal.FPS_TacticalPointType.GUARD_POINT,
                   unreal.FPS_BotRole.DEFENDER, unreal.Vector(650, 400, 100))
    tactical_point("Retreat Point", unreal.FPS_TacticalPointType.RETREAT_POINT,
                   unreal.FPS_BotRole.SUPPORT, unreal.Vector(-650, 400, 100))

    camera = actors.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0, -1050, 650), unreal.Rotator(-20, 90, 0))
    camera.set_actor_label("Fixed Spectator Camera")
    camera.set_editor_property("tags", ["FixedSpectatorCamera"])

    test_actor = actors.spawn_actor_from_class(test.generated_class(), unreal.Vector(0, 0, 700), unreal.Rotator())
    test_actor.set_actor_label("FPS 3v3 Elimination Functional Test")
    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {MAP}")
    unreal.log("FPS_TASK8_ASSETS_BUILT managers=2 tasks=3 spectator=1 functional_tests=1 spawns=6 tactical_points=3 behavior_tree=updated")


main()
