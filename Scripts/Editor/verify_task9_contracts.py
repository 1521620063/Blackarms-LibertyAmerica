import unreal


MAP = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"
CORE_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLADataCore"
ZONE_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLAObjectiveZone"
MANAGER_BLUEPRINT = "/Game/BLA/Blueprints/Objectives/BP_BLAObjectiveManager"
TEST_BLUEPRINT = "/Game/BLA/Tests/FT_BLA_DataCore"
OBJECTIVE_TREE = "/Game/BLA/AI/BehaviorTrees/BT_BLABotObjective"
BLACKBOARD = "/Game/BLA/AI/Blackboards/BB_BLABot"
OBJECTIVE_TASK_PATHS = [
    "/Game/BLA/AI/Tasks/BTT_BLASeekDataCore",
    "/Game/BLA/AI/Tasks/BTT_BLACarryDataCore",
    "/Game/BLA/AI/Tasks/BTT_BLAPlantDataCore",
    "/Game/BLA/AI/Tasks/BTT_BLADefendObjective",
    "/Game/BLA/AI/Tasks/BTT_BLADefuseDataCore",
]

REQUIRED_STATES = {
    "NONE", "AVAILABLE", "CARRIED", "DROPPED", "PLANTING",
    "PLANTED", "UPLOADING", "DEFUSING", "DEFUSED", "COMPLETED",
}
REQUIRED_MANAGER_FUNCTIONS = {
    "configure", "begin_pickup", "begin_plant", "begin_defuse",
    "cancel_interaction", "handle_carrier_death", "reset_objective",
    "is_objective_in_valid_area",
}
REQUIRED_AI_FUNCTIONS = {"configure_objective", "resolve_objective_directive"}
FORBIDDEN_CORE_FUNCTIONS = {
    "complete_plant", "complete_defuse", "complete_upload",
    "complete_objective", "finish_objective",
}
PRESERVED_LABELS = {
    "Arena Floor", "Attacker Protected Spawn", "Defender Protected Spawn",
    "Cover Left", "Cover Center", "Cover Right",
    "1v1 Arena Navigation Bounds", "BLA 1v1 Elimination Functional Test",
    "BLA 3v3 Elimination Functional Test", "Fixed Spectator Camera",
}
TASK9_LABELS = {
    "Data Core", "Data Core Objective Zone",
    "Data Core Plant Point", "Data Core Defuse Point",
    "BLA Data Core Functional Test",
}


def fail(message):
    raise RuntimeError("TASK9_CONTRACT_FAILURE " + message)


def require_native_type(name):
    native_type = getattr(unreal, name, None)
    if native_type is None:
        fail(f"missing native type unreal.{name}")
    return native_type


def require_blueprint(path, parent_path):
    if not unreal.get_editor_subsystem(unreal.EditorAssetSubsystem).does_asset_exist(path):
        fail(f"missing asset {path}")
    blueprint = unreal.load_asset(path)
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
    if parent.get_path_name() != parent_path:
        fail(f"unexpected parent for {path}: {parent.get_path_name()}")
    return blueprint


def main():
    core_type = require_native_type("BLADataCore")
    require_native_type("BLAObjectiveZone")
    manager_type = require_native_type("BLAObjectiveManager")
    test_type = require_native_type("BLADataCoreTest")

    states = {value.name for value in unreal.BLA_ObjectiveState}
    missing_states = REQUIRED_STATES - states
    if missing_states:
        fail(f"objective states missing {sorted(missing_states)}")

    manager_functions = {name.lower() for name in dir(manager_type)}
    missing_functions = REQUIRED_MANAGER_FUNCTIONS - manager_functions
    if missing_functions:
        fail(f"objective manager missing functions {sorted(missing_functions)}")
    core_functions = {name.lower() for name in dir(core_type)}
    leaked = FORBIDDEN_CORE_FUNCTIONS & core_functions
    if leaked:
        fail(f"data core exposes completion API {sorted(leaked)}")

    require_blueprint(CORE_BLUEPRINT, "/Script/BLA.BLADataCore")
    require_blueprint(ZONE_BLUEPRINT, "/Script/BLA.BLAObjectiveZone")
    require_blueprint(MANAGER_BLUEPRINT, "/Script/BLA.BLAObjectiveManager")
    require_blueprint(TEST_BLUEPRINT, "/Script/BLA.BLADataCoreTest")
    for task_path in OBJECTIVE_TASK_PATHS:
        require_blueprint(task_path, "/Script/AIModule.BTTask_BlueprintBase")

    ai_functions = {name.lower() for name in dir(require_native_type("BLAAIController"))}
    missing_ai_functions = REQUIRED_AI_FUNCTIONS - ai_functions
    if missing_ai_functions:
        fail(f"ai controller missing objective functions {sorted(missing_ai_functions)}")

    objective_tree = unreal.load_asset(OBJECTIVE_TREE)
    if objective_tree is None:
        fail(f"missing asset {OBJECTIVE_TREE}")
    if objective_tree.get_editor_property("blackboard_asset") != unreal.load_asset(BLACKBOARD):
        fail("objective tree must use BB_BLABot")
    root = objective_tree.get_editor_property("root_node")
    root_children = root.get_editor_property("children") if root else []
    if len(root_children) != 2:
        fail("objective tree must keep the combat branch plus the objective selector")
    objective_selector = root_children[1].get_editor_property("child_composite")
    objective_children = objective_selector.get_editor_property("children") if objective_selector else []
    if len(objective_children) != 5:
        fail("objective selector must contain the five objective tasks")

    if not unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(MAP):
        fail(f"could not load map {MAP}")
    level_actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    labels = {actor.get_actor_label() for actor in level_actors}
    missing_labels = (PRESERVED_LABELS | TASK9_LABELS) - labels
    if missing_labels:
        fail(f"map missing required actors {sorted(missing_labels)}")

    cores = [actor for actor in level_actors if isinstance(actor, core_type)]
    zones = [actor for actor in level_actors if isinstance(actor, unreal.BLAObjectiveZone)]
    tests = [actor for actor in level_actors if isinstance(actor, test_type)]
    if len(cores) != 1 or len(zones) != 1 or len(tests) != 1:
        fail(f"objective actor counts core={len(cores)} zone={len(zones)} tests={len(tests)}")

    tactical = [actor for actor in level_actors if isinstance(actor, unreal.BLATacticalPoint)]
    plant_points = [actor for actor in tactical if actor.get_editor_property("point_type") == unreal.BLA_TacticalPointType.PLANT_POINT]
    defuse_points = [actor for actor in tactical if actor.get_editor_property("point_type") == unreal.BLA_TacticalPointType.DEFUSE_POINT]
    if len(plant_points) != 1 or len(defuse_points) != 1:
        fail(f"objective tactical points plant={len(plant_points)} defuse={len(defuse_points)}")
    if not all(actor.get_editor_property("is_objective_point") for actor in plant_points + defuse_points):
        fail("plant/defuse points must be flagged as objective points")

    if not any(actor.actor_has_tag("BLAObjectiveCore") for actor in cores):
        fail("data core is missing the BLAObjectiveCore tag")
    if not any(actor.actor_has_tag("BLAObjectiveZone") for actor in zones):
        fail("objective zone is missing the BLAObjectiveZone tag")

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    path = unreal.NavigationSystemV1.find_path_to_location_synchronously(
        world, unreal.Vector(-1000.0, -600.0, 20.0), unreal.Vector(400.0, 0.0, 20.0))
    if path is None or not path.is_valid():
        fail("objective zone is not reachable from the attacker side")

    unreal.log("BLA_TASK9_CONTRACTS_OK native=4 blueprints=4 states=10 manager_functions=8 core_completion_api=0 "
               "core=1 zone=1 tactical=2 functional_tests=1 map_preserved=1 objective_tasks=5 behavior_trees=1")


main()
