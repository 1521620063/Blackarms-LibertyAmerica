import unreal


AI_BP = "/Game/FPS/Blueprints/AI"
AI_ROOT = "/Game/FPS/AI"
TEST_PATH = "/Game/FPS/Tests"

BLUEPRINTS = {
    f"{AI_BP}/BP_FPSAIController": "/Script/FPS.FPSAIController",
    f"{AI_BP}/BP_FPSBotPerception": "/Script/FPS.FPSBotPerception",
    f"{AI_BP}/BP_FPSTacticalManager": "/Script/FPS.FPSTacticalManager",
    f"{AI_BP}/BP_FPSTacticalPoint": "/Script/FPS.FPSTacticalPoint",
    f"{AI_ROOT}/Tasks/BTT_FPSMoveToTacticalPoint": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Tasks/BTT_FPSAimAndFire": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Tasks/BTT_FPSFindCover": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Tasks/BTT_FPSSearchLastKnownPosition": "/Script/AIModule.BTTask_BlueprintBase",
    f"{AI_ROOT}/Services/BTS_FPSUpdateTarget": "/Script/AIModule.BTService_BlueprintBase",
    f"{AI_ROOT}/Services/BTS_FPSCheckStuck": "/Script/AIModule.BTService_BlueprintBase",
    f"{AI_ROOT}/Decorators/BPD_FPSHasLiveTarget": "/Script/AIModule.BTDecorator_BlueprintBase",
    f"{TEST_PATH}/BP_FPSAITestFixture": "/Script/FPS.FPSAITestFixture",
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
        "FPSAIController",
        "FPSBotPerception",
        "FPSTacticalManager",
        "FPSTacticalPoint",
        "FPSAITestFixture",
    ]:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    point = unreal.FPSTacticalPoint()
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

    controller = unreal.FPSAIController()
    for field in ["applied_aim_error_degrees", "max_engagement_distance"]:
        try:
            controller.get_editor_property(field)
        except Exception as error:
            fail(f"AI controller missing difficulty field {field}: {error}")

    for path, expected_parent in BLUEPRINTS.items():
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != expected_parent:
            fail(f"{path} parent: expected {expected_parent}, got {parent.get_path_name()}")

    blackboard_path = f"{AI_ROOT}/Blackboards/BB_FPSBot"
    blackboard = unreal.load_asset(blackboard_path)
    if blackboard is None:
        fail(f"missing Blackboard {blackboard_path}")
    actual_keys = {str(entry.get_editor_property("entry_name")) for entry in blackboard.get_editor_property("keys")}
    missing_keys = EXPECTED_KEYS - actual_keys
    if missing_keys:
        fail(f"blackboard missing required keys: {missing_keys}")

    tree_path = f"{AI_ROOT}/BehaviorTrees/BT_FPSBotElimination"
    tree = unreal.load_asset(tree_path)
    if tree is None:
        fail(f"missing Behavior Tree {tree_path}")
    if tree.get_editor_property("blackboard_asset") != blackboard:
        fail("elimination tree is not bound to BB_FPSBot")
    root = tree.get_editor_property("root_node")
    if root is None or len(root.get_editor_property("children")) != 4 or len(root.get_editor_property("services")) != 2:
        fail("elimination tree must contain four priority tasks and two update services")

    unreal.log("FPS_TASK6_CONTRACTS_OK native=5 blueprints=12 blackboard_keys=9 behavior_trees=1")


main()
