import unreal


MENU_MAP = "L_TestBootstrap"
MATCH_MAP = "L_BLA_1v1_Elimination"
MAX_STARTUP_TICKS = 600
MAX_PHASE_TICKS = 1200

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {
    "ticks": 0,
    "pie": 0,
    "phase": "menu",
    "menu_ok": False,
    "match_ok": False,
    "travel_requested": False,
    "return_requested": False,
    "ending": False,
}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"BLA_TASK10_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def get_world():
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()


def flow_tests(game_world, kind):
    tests = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAUIFlowTest) if game_world else []
    return [test for test in tests if test.get_editor_property("flow") == kind]


def tick_impl():
    state["ticks"] += 1
    if state["ending"]:
        if not level.is_in_play_in_editor():
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
        return
    if not level.is_in_play_in_editor():
        if state["ticks"] >= MAX_STARTUP_TICKS:
            finish(False, "PIE did not start")
        return
    state["pie"] += 1

    game_world = get_world()
    if game_world is None:
        return
    map_path = game_world.get_path_name()

    if state["phase"] == "menu":
        for test in flow_tests(game_world, unreal.BLA_UIFlowKind.MENU):
            if test.get_editor_property("test_failed"):
                finish(False, f"menu_flow reason={test.get_editor_property('failure_reason')}")
                return
            if test.get_editor_property("test_succeeded"):
                state["menu_ok"] = True
        if state["menu_ok"] and not state.get("travel_requested"):
            # Exercise the production entry point from the driver, so the menu test actor
            # itself stays side-effect free for the other matrix drivers.
            managers = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAUIManager)
            if not managers:
                finish(False, "menu_flow ui_manager_missing_for_travel")
                return
            managers[0].start_match()
            state["travel_requested"] = True
            unreal.log("BLA_TASK10_PIE_TRAVEL_REQUESTED start_match=1")
        if state["travel_requested"] and MATCH_MAP in map_path:
            state["phase"] = "match"
            state["pie"] = 0
        elif state["pie"] >= MAX_PHASE_TICKS:
            finish(False, f"menu_flow did not travel map={map_path} menu_ok={state['menu_ok']}")
        return

    for test in flow_tests(game_world, unreal.BLA_UIFlowKind.MATCH):
        if test.get_editor_property("test_failed"):
            finish(False, f"match_flow reason={test.get_editor_property('failure_reason')}")
            return
        if test.get_editor_property("test_succeeded"):
            state["match_ok"] = True
    if state["match_ok"] and not state.get("return_requested"):
        managers = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAUIManager)
        if not managers:
            finish(False, "match_flow ui_manager_missing_for_return")
            return
        managers[0].return_to_menu()
        state["return_requested"] = True
        unreal.log("BLA_TASK10_PIE_TRAVEL_REQUESTED return_to_menu=1")
    if state["return_requested"] and MENU_MAP in map_path:
        finish(True, f"menu={int(state['menu_ok'])} match={int(state['match_ok'])} travel=roundtrip")
        return
    if state["pie"] >= MAX_PHASE_TICKS:
        finish(False, f"match_flow did not return map={map_path} match_ok={state['match_ok']}")


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        finish(False, f"driver_error {error}")


if not level.load_level("/Game/BLA/Maps/Graybox/L_TestBootstrap"):
    raise RuntimeError("Failed to load the menu map")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_TASK10_PIE_DRIVER_STARTED")
