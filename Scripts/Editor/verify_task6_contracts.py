import unreal


AI_BP = "/Game/BLA/Blueprints/AI"
AI_ROOT = "/Game/BLA/AI"
TEST_PATH = "/Game/BLA/Tests"

BLUEPRINTS = {
    f"{AI_BP}/BP_BLAAIController": "/Script/BLA.BLAAIController",
    f"{AI_BP}/BP_BLABotPerception": "/Script/BLA.BLABotPerception",
    f"{AI_BP}/BP_BLATacticalManager": "/Script/BLA.BLATacticalManager",
    f"{AI_BP}/BP_BLATacticalPoint": "/Script/BLA.BLATacticalPoint",
    f"{AI_ROOT}/Tasks/BTT_BLAMoveToTacticalPoint": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Tasks/BTT_BLAAimAndFire": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Tasks/BTT_BLAFindCover": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Tasks/BTT_BLASearchLastKnownPosition": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Services/BTS_BLAUpdateTarget": "/Script/AIModule.BTService_BlueprintBase",
    f"{AI_ROOT}/Services/BTS_BLACheckStuck": "/Script/AIModule.BTService_BlueprintBase",
    f"{AI_ROOT}/Decorators/BPD_BLAHasLiveTarget": "/Script/AIModule.BTDecorator_BlueprintBase",
    f"{TEST_PATH}/BP_BLAAITestFixture": "/Script/BLA.BLAAITestFixture",
}

EXPECTED_KEYS = {
    "TargetActor",
    "LastKnownTargetLocation",
    "CurrentTacticalPoint",
    "CurrentTask",
    "Team",
    "BotRole",
    "HasObjectiveCore",
    "IsUnderFire",
    "IsStuck",
}


def fail(message):
    raise RuntimeError("TASK6_CONTRACT_FAILURE " + message)


def main():
    for name in [
        "BLAAIController",
        "BLABotPerception",
        "BLATacticalManager",
        "BLATacticalPoint",
        "BLAAITestFixture",
    ]:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    point = unreal.BLATacticalPoint()
    for field in [
        "point_type",
        "team",
        "preferred_role",
        "priority",
        "is_occupied",
        "is_objective_point",
    ]:
        try:
            point.get_editor_property(field)
        except Exception as error:
            fail(f"tactical point missing {field}: {error}")

    controller = unreal.BLAAIController()
    for field in [
        "applied_aim_error_degrees",
        "max_engagement_distance",
        "applied_vision_reaction_seconds",
        "applied_fire_delay_seconds",
        "applied_search_seconds",
        "applied_tactical_execution_probability",
        "applied_team_assist_probability",
        "target_lost",
    ]:
        try:
            controller.get_editor_property(field)
        except Exception as error:
            fail(f"AI controller missing field {field}: {error}")
    if not callable(getattr(controller, "is_fire_delay_elapsed", None)):
        fail("AI controller is missing the is_fire_delay_elapsed gate")

    perception = unreal.BLABotPerception()
    try:
        perception.get_editor_property("hearing_radius")
    except Exception as error:
        fail(f"bot perception missing hearing_radius: {error}")

    for path, expected_parent in BLUEPRINTS.items():
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != expected_parent:
            fail(f"{path} parent: expected {expected_parent}, got {parent.get_path_name()}")

    blackboard_path = f"{AI_ROOT}/Blackboards/BB_BLABot"
    blackboard = unreal.load_asset(blackboard_path)
    if blackboard is None:
        fail(f"missing Blackboard {blackboard_path}")
    actual_keys = {str(entry.get_editor_property("entry_name")) for entry in blackboard.get_editor_property("keys")}
    missing_keys = EXPECTED_KEYS - actual_keys
    if missing_keys:
        fail(f"blackboard missing required keys: {missing_keys}")

    tree_path = f"{AI_ROOT}/BehaviorTrees/BT_BLABotElimination"
    tree = unreal.load_asset(tree_path)
    if tree is None:
        fail(f"missing Behavior Tree {tree_path}")
    if tree.get_editor_property("blackboard_asset") != blackboard:
        fail("elimination tree is not bound to BB_BLABot")
    root = tree.get_editor_property("root_node")
    if root is None or len(root.get_editor_property("children")) != 4 or len(root.get_editor_property("services")) != 2:
        fail("elimination tree must contain four priority tasks and two update services")

    unreal.log("BLA_TASK6_CONTRACTS_OK native=5 blueprints=12 blackboard_keys=9 behavior_trees=1 difficulty_parameters=6")


main()
