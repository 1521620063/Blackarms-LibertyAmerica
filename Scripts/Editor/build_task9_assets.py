import unreal


MAP = "/Game/FPS/Maps/Graybox/L_FPS_1v1_Elimination"
CORE_BLUEPRINT = "/Game/FPS/Blueprints/Objectives/BP_FPSDataCore"
ZONE_BLUEPRINT = "/Game/FPS/Blueprints/Objectives/BP_FPSObjectiveZone"
MANAGER_BLUEPRINT = "/Game/FPS/Blueprints/Objectives/BP_FPSObjectiveManager"
TEST_BLUEPRINT = "/Game/FPS/Tests/FT_FPS_DataCore"
OBJECTIVE_TREE = "/Game/FPS/AI/BehaviorTrees/BT_FPSBotObjective"
BLACKBOARD = "/Game/FPS/AI/Blackboards/BB_FPSBot"
OBJECTIVE_TASKS = [
    "BTT_FPSSeekDataCore",
    "BTT_FPSCarryDataCore",
    "BTT_FPSPlantDataCore",
    "BTT_FPSDefendObjective",
    "BTT_FPSDefuseDataCore",
]

TASK9_LABELS = {
    "Data Core",
    "Data Core Objective Zone",
    "Data Core Plant Point",
    "Data Core Defuse Point",
    "FPS Data Core Functional Test",
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


def spawn_core(core_blueprint, location):
    core = actors.spawn_actor_from_class(core_blueprint.generated_class(), location, unreal.Rotator())
    if core is None:
        raise RuntimeError("Failed to place the data core")
    core.set_actor_label("Data Core")
    core.set_editor_property("tags", ["FPSObjectiveCore"])
    return core


def spawn_zone(zone_blueprint, location):
    zone = actors.spawn_actor_from_class(zone_blueprint.generated_class(), location, unreal.Rotator())
    if zone is None:
        raise RuntimeError("Failed to place the objective zone")
    zone.set_actor_label("Data Core Objective Zone")
    zone.set_editor_property("tags", ["FPSObjectiveZone"])
    zone.set_editor_property("zone_extent", unreal.Vector(300.0, 300.0, 200.0))
    return zone


def spawn_tactical_point(label, point_type, role, location):
    point = actors.spawn_actor_from_class(unreal.FPSTacticalPoint, location, unreal.Rotator())
    if point is None:
        raise RuntimeError(f"Failed to place {label}")
    point.set_actor_label(label)
    point.set_editor_properties({
        "point_type": point_type,
        "team": unreal.FPS_Team.NEUTRAL,
        "preferred_role": role,
        "priority": 3.0,
        "is_objective_point": True,
    })
    return point


def main():
    core_blueprint = blueprint(CORE_BLUEPRINT, unreal.FPSDataCore)
    zone_blueprint = blueprint(ZONE_BLUEPRINT, unreal.FPSObjectiveZone)
    blueprint(MANAGER_BLUEPRINT, unreal.FPSObjectiveManager)
    test_blueprint = blueprint(TEST_BLUEPRINT, unreal.FPSDataCoreTest)
    objective_task_blueprints = [blueprint(f"/Game/FPS/AI/Tasks/{name}", unreal.BTTask_BlueprintBase) for name in OBJECTIVE_TASKS]
    combat_task = unreal.load_asset("/Game/FPS/AI/Tasks/BTT_FPSAimAndFire")
    services = [
        unreal.load_asset("/Game/FPS/AI/Services/BTS_FPSUpdateTarget"),
        unreal.load_asset("/Game/FPS/AI/Services/BTS_FPSCheckStuck"),
    ]
    blackboard = unreal.load_asset(BLACKBOARD)
    if not unreal.get_editor_subsystem(unreal.EditorAssetSubsystem).does_asset_exist(OBJECTIVE_TREE):
        unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            "BT_FPSBotObjective", "/Game/FPS/AI/BehaviorTrees", unreal.BehaviorTree, unreal.BehaviorTreeFactory())
    tree = unreal.load_asset(OBJECTIVE_TREE)
    if tree is None or blackboard is None or combat_task is None:
        raise RuntimeError("Failed to load the objective behavior tree inputs")
    if not unreal.FPSBlueprintAssetBuilder.configure_fps_bot_objective_behavior_tree(
            tree, blackboard, [combat_task.generated_class()],
            [task.generated_class() for task in objective_task_blueprints],
            [service.generated_class() for service in services]):
        raise RuntimeError("Failed to configure BT_FPSBotObjective")
    save(tree)

    if not levels.load_level(MAP):
        raise RuntimeError(f"Failed to load {MAP}")
    for actor in actors.get_all_level_actors():
        if actor.get_actor_label() in TASK9_LABELS:
            actors.destroy_actor(actor)

    spawn_core(core_blueprint, unreal.Vector(400.0, 0.0, 150.0))
    spawn_zone(zone_blueprint, unreal.Vector(400.0, 0.0, 150.0))
    spawn_tactical_point("Data Core Plant Point", unreal.FPS_TacticalPointType.PLANT_POINT,
                         unreal.FPS_BotRole.ASSAULT, unreal.Vector(300.0, -150.0, 100.0))
    spawn_tactical_point("Data Core Defuse Point", unreal.FPS_TacticalPointType.DEFUSE_POINT,
                         unreal.FPS_BotRole.DEFENDER, unreal.Vector(500.0, 150.0, 100.0))

    test_actor = actors.spawn_actor_from_class(test_blueprint.generated_class(), unreal.Vector(0.0, 0.0, 700.0), unreal.Rotator())
    if test_actor is None:
        raise RuntimeError("Failed to place the data core functional test")
    test_actor.set_actor_label("FPS Data Core Functional Test")

    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {MAP}")
    unreal.log("FPS_TASK9_ASSETS_BUILT objectives=3 functional_tests=1 tactical_points=2 core=1 zone=1 "
               "objective_tasks=5 behavior_trees=1")
    unreal.SystemLibrary.quit_editor()


main()
