import unreal


MAP = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"

# Actors this generator owns. Task 9 adds the data core, its zone and its two objective
# tactical points (plus a functional test) to the same level; this rebuild must not
# delete them when it runs after task 9.
TASK8_LABELS = {
    "Attacker Protected Spawn",
    "Defender Protected Spawn",
    "Attacker Spawn 2",
    "Attacker Spawn 3",
    "Defender Spawn 2",
    "Defender Spawn 3",
    "Attack Route Point",
    "Guard Point",
    "Retreat Point",
    "Fixed Spectator Camera",
    "BLA 3v3 Elimination Functional Test",
}

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
    point = actors.spawn_actor_from_class(unreal.BLASpawnPoint, location, rotation)
    if point is None:
        raise RuntimeError(f"Failed to create {label}")
    point.set_actor_label(label)
    point.set_editor_properties({"team": team, "zone": zone})


def tactical_point(label, point_type, role, location):
    point = actors.spawn_actor_from_class(unreal.BLATacticalPoint, location, unreal.Rotator())
    if point is None:
        raise RuntimeError(f"Failed to create {label}")
    point.set_actor_label(label)
    point.set_editor_properties({
        "point_type": point_type,
        "team": unreal.BLA_Team.NEUTRAL,
        "preferred_role": role,
        "priority": 2.0,
    })


def main():
    order_manager = blueprint("/Game/BLA/Blueprints/Teams/BP_BLATeamOrderManager", unreal.BLATeamOrderManager)
    role_assignment = blueprint("/Game/BLA/Blueprints/Teams/BP_BLARoleAssignment", unreal.BLARoleAssignment)
    follow = blueprint("/Game/BLA/AI/Tasks/BTT_BLAFollowPlayer", unreal.BTTask_BlueprintBase)
    guard = blueprint("/Game/BLA/AI/Tasks/BTT_BLAGuardPoint", unreal.BTTask_BlueprintBase)
    attack = blueprint("/Game/BLA/AI/Tasks/BTT_BLAAttackRoute", unreal.BTTask_BlueprintBase)
    blueprint("/Game/BLA/Blueprints/UI/WBP_BLASpectator", unreal.UserWidget)
    test = blueprint("/Game/BLA/Tests/FT_BLA_3v3_Elimination", unreal.BLA3v3EliminationTest)

    tree = unreal.load_asset("/Game/BLA/AI/BehaviorTrees/BT_BLABotElimination")
    blackboard = unreal.load_asset("/Game/BLA/AI/Blackboards/BB_BLABot")
    base_tasks = [
        unreal.load_asset("/Game/BLA/AI/Tasks/BTT_BLAAimAndFire"),
        unreal.load_asset("/Game/BLA/AI/Tasks/BTT_BLAFindCover"),
        unreal.load_asset("/Game/BLA/AI/Tasks/BTT_BLASearchLastKnownPosition"),
        unreal.load_asset("/Game/BLA/AI/Tasks/BTT_BLAMoveToTacticalPoint"),
    ]
    services = [
        unreal.load_asset("/Game/BLA/AI/Services/BTS_BLAUpdateTarget"),
        unreal.load_asset("/Game/BLA/AI/Services/BTS_BLACheckStuck"),
    ]
    if not unreal.BLABlueprintAssetBuilder.configure_bla_bot_team_behavior_tree(
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
        if actor.get_actor_label() in TASK8_LABELS:
            actors.destroy_actor(actor)
        elif isinstance(actor, unreal.CameraActor) and actor.actor_has_tag("FixedSpectatorCamera"):
            actors.destroy_actor(actor)

    for index, y in enumerate((-500.0, 0.0, 500.0), start=1):
        attacker_label = "Attacker Protected Spawn" if index == 1 else f"Attacker Spawn {index}"
        defender_label = "Defender Protected Spawn" if index == 1 else f"Defender Spawn {index}"
        spawn_point(attacker_label, unreal.BLA_Team.ATTACKERS,
                    unreal.Vector(-1020, y, 120), unreal.Rotator(0, 0, 0), "AttackSpawn")
        spawn_point(defender_label, unreal.BLA_Team.DEFENDERS,
                    unreal.Vector(1020, -y, 120), unreal.Rotator(0, 180, 0), "DefenseSpawn")

    tactical_point("Attack Route Point", unreal.BLA_TacticalPointType.ATTACK_POINT,
                   unreal.BLA_BotRole.ASSAULT, unreal.Vector(300, -400, 100))
    tactical_point("Guard Point", unreal.BLA_TacticalPointType.GUARD_POINT,
                   unreal.BLA_BotRole.DEFENDER, unreal.Vector(650, 400, 100))
    tactical_point("Retreat Point", unreal.BLA_TacticalPointType.RETREAT_POINT,
                   unreal.BLA_BotRole.SUPPORT, unreal.Vector(-650, 400, 100))

    camera = actors.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(0, -1050, 650), unreal.Rotator(-20, 90, 0))
    camera.set_actor_label("Fixed Spectator Camera")
    camera.set_editor_property("tags", ["FixedSpectatorCamera"])

    test_actor = actors.spawn_actor_from_class(test.generated_class(), unreal.Vector(0, 0, 700), unreal.Rotator())
    test_actor.set_actor_label("BLA 3v3 Elimination Functional Test")
    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {MAP}")
    unreal.log("BLA_TASK8_ASSETS_BUILT managers=2 tasks=3 spectator=1 functional_tests=1 spawns=6 tactical_points=3 behavior_tree=updated")


main()
