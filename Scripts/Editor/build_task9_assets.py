import unreal


MAP = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"
CORE_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLADataCore"
ZONE_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLAObjectiveZone"
MANAGER_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLAObjectiveManager"
TEST_BLUEPRINT = "/Game/BLA/Tests/FT_BLA_DataCore"
OBJECTIVE_TREE = "/Game/BLA/AI/BehaviorTrees/BT_BLABotObjective"
BLACKBOARD = "/Game/BLA/AI/Blackboards/BB_BLABot"
OBJECTIVE_TASKS = [
    "BTT_BLASeekDataCore",
    "BTT_BLACarryDataCore",
    "BTT_BLAPlantDataCore",
    "BTT_BLADefendObjective",
    "BTT_BLADefuseDataCore",
]

TASK9_LABELS = {
    "Data Core",
    "Data Core Objective Zone",
    "BLA Objective Manager",
    "Data Core Plant Point",
    "Data Core Defuse Point",
    "BLA Data Core Functional Test",
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
    core.set_editor_property("tags", ["BLAObjectiveCore"])
    return core


def spawn_zone(zone_blueprint, location):
    zone = actors.spawn_actor_from_class(zone_blueprint.generated_class(), location, unreal.Rotator())
    if zone is None:
        raise RuntimeError("Failed to place the objective zone")
    zone.set_actor_label("Data Core Objective Zone")
    zone.set_editor_property("tags", ["BLAObjectiveZone"])
    zone.set_editor_property("zone_extent", unreal.Vector(300.0, 300.0, 200.0))
    return zone


def spawn_manager(manager_blueprint, core, zone):
    manager = actors.spawn_actor_from_class(manager_blueprint.generated_class(), unreal.Vector(0.0, 0.0, 0.0), unreal.Rotator())
    if manager is None:
        raise RuntimeError("Failed to place the objective manager")
    manager.set_actor_label("BLA Objective Manager")
    manager.set_editor_property("tags", ["BLALevelObjectiveManager"])
    manager.set_editor_property("data_core", core)
    manager.set_editor_property("objective_zone", zone)
    return manager


def spawn_tactical_point(label, point_type, role, location):
    point = actors.spawn_actor_from_class(unreal.BLATacticalPoint, location, unreal.Rotator())
    if point is None:
        raise RuntimeError(f"Failed to place {label}")
    point.set_actor_label(label)
    point.set_editor_properties({
        "point_type": point_type,
        "team": unreal.BLA_Team.NEUTRAL,
        "preferred_role": role,
        "priority": 3.0,
        "is_objective_point": True,
    })
    return point


def main():
    core_blueprint = blueprint(CORE_BLUEPRINT, unreal.BLADataCore)
    zone_blueprint = blueprint(ZONE_BLUEPRINT, unreal.BLAObjectiveZone)
    blueprint(MANAGER_BLUEPRINT, unreal.BLAObjectiveManager)
    test_blueprint = blueprint(TEST_BLUEPRINT, unreal.BLADataCoreTest)
    objective_task_blueprints = [blueprint(f"/Game/BLA/AI/Tasks/{name}", unreal.BTTask_BlueprintBase) for name in OBJECTIVE_TASKS]
    combat_task = unreal.load_asset("/Game/BLA/AI/Tasks/BTT_BLAAimAndFire")
    services = [
        unreal.load_asset("/Game/BLA/AI/Services/BTS_BLAUpdateTarget"),
        unreal.load_asset("/Game/BLA/AI/Services/BTS_BLACheckStuck"),
    ]
    blackboard = unreal.load_asset(BLACKBOARD)
    if not unreal.get_editor_subsystem(unreal.EditorAssetSubsystem).does_asset_exist(OBJECTIVE_TREE):
        unreal.AssetToolsHelpers.get_asset_tools().create_asset(
            "BT_BLABotObjective", "/Game/BLA/AI/BehaviorTrees", unreal.BehaviorTree, unreal.BehaviorTreeFactory())
    tree = unreal.load_asset(OBJECTIVE_TREE)
    if tree is None or blackboard is None or combat_task is None:
        raise RuntimeError("Failed to load the objective behavior tree inputs")
    if not unreal.BLABlueprintAssetBuilder.configure_bla_bot_objective_behavior_tree(
            tree, blackboard, [combat_task.generated_class()],
            [task.generated_class() for task in objective_task_blueprints],
            [service.generated_class() for service in services]):
        raise RuntimeError("Failed to configure BT_BLABotObjective")
    save(tree)

    if not levels.load_level(MAP):
        raise RuntimeError(f"Failed to load {MAP}")
    for actor in actors.get_all_level_actors():
        if actor.get_actor_label() in TASK9_LABELS:
            actors.destroy_actor(actor)

    core_actor = spawn_core(core_blueprint, unreal.Vector(400.0, 0.0, 150.0))
    zone_actor = spawn_zone(zone_blueprint, unreal.Vector(400.0, 0.0, 150.0))
    manager_blueprint = blueprint(MANAGER_BLUEPRINT, unreal.BLAObjectiveManager)
    spawn_manager(manager_blueprint, core_actor, zone_actor)
    spawn_tactical_point("Data Core Plant Point", unreal.BLA_TacticalPointType.PLANT_POINT,
                         unreal.BLA_BotRole.ASSAULT, unreal.Vector(300.0, -150.0, 100.0))
    spawn_tactical_point("Data Core Defuse Point", unreal.BLA_TacticalPointType.DEFUSE_POINT,
                         unreal.BLA_BotRole.DEFENDER, unreal.Vector(500.0, 150.0, 100.0))

    test_actor = actors.spawn_actor_from_class(test_blueprint.generated_class(), unreal.Vector(0.0, 0.0, 700.0), unreal.Rotator())
    if test_actor is None:
        raise RuntimeError("Failed to place the data core functional test")
    test_actor.set_actor_label("BLA Data Core Functional Test")

    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {MAP}")
    unreal.log("BLA_TASK9_ASSETS_BUILT objectives=3 functional_tests=1 tactical_points=2 core=1 zone=1 "
               "objective_tasks=5 behavior_trees=1")
    unreal.SystemLibrary.quit_editor()


main()
