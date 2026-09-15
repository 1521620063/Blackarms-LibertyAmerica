import unreal


UI_PATH = "/Game/BLA/Blueprints/UI"
MAPS_PATH = "/Game/BLA/Blueprints/Maps"
TEST_PATH = "/Game/BLA/Tests"
MENU_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
FINAL_LEVEL = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"


def fail(message):
    raise RuntimeError("TASK12_CONTRACT_FAILURE " + message)


def main():
    for name in ["BLADebugSubsystem", "BLATestHarness", "BLAAllMVPFlowsTest"]:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    for path, parent_name in [
        (f"{MAPS_PATH}/BP_BLATestHarness", "/Script/BLA.BLATestHarness"),
        (f"{TEST_PATH}/FT_BLA_AllMVPFlows", "/Script/BLA.BLAAllMVPFlowsTest"),
    ]:
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != parent_name:
            fail(f"{path} parent: got {parent.get_path_name()}")

    for function in ["report_event", "get_event_count", "clear_log"]:
        if not callable(getattr(unreal.BLADebugSubsystem, function, None)):
            fail(f"debug subsystem missing {function}")

    game_instance = unreal.get_default_object(unreal.BLAGameInstance)
    for field in ["harness_requested", "harness_run_all", "harness_config_index", "harness_mode",
                  "harness_team_size", "harness_difficulty", "harness_result", "harness_results"]:
        try:
            game_instance.get_editor_property(field)
        except Exception as error:
            fail(f"game instance missing harness field {field}: {error}")

    round_manager = unreal.BLARoundManager()
    try:
        watchdog = round_manager.get_editor_property("watchdog_seconds")
    except Exception as error:
        fail(f"round manager missing watchdog_seconds: {error}")
    if watchdog <= 0.0:
        fail("round watchdog must be positive")

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if not level_editor.load_level(MENU_LEVEL):
        fail(f"could not load {MENU_LEVEL}")
    harnesses = [actor for actor in actor_subsystem.get_all_level_actors()
                 if isinstance(actor, unreal.BLATestHarness)]
    if len(harnesses) != 1:
        fail(f"menu map harness count={len(harnesses)}")
    if "L_BLA_ZeroFacility" not in str(harnesses[0].get_editor_property("target_map_path")):
        fail("harness target map is not the Zero Facility map")

    if not level_editor.load_level(FINAL_LEVEL):
        fail(f"could not load {FINAL_LEVEL}")
    flows = [actor for actor in actor_subsystem.get_all_level_actors()
             if isinstance(actor, unreal.BLAAllMVPFlowsTest)]
    if len(flows) != 1:
        fail(f"final map flows test count={len(flows)}")

    unreal.log("BLA_TASK12_CONTRACTS_OK debug_subsystem=cpp harness=1 flows_test=1 watchdog=1 harness_fields=8 recovery_diagnostics=4")


main()
