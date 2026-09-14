import unreal


MAP = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"
MAX_STARTUP_TICKS = 600
VALIDATION_TICKS = 300

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie": 0, "ending": False}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"BLA_TASK9_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def tick(_):
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
    if state["pie"] < VALIDATION_TICKS:
        return
    game_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    tests = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLADataCoreTest)
    if len(tests) != 1:
        finish(False, f"data core functional test count={len(tests)}")
        return
    test = tests[0]
    if test.get_editor_property("test_failed"):
        finish(False, f"data core test failed reason={test.get_editor_property('failure_reason')}")
        return
    if not test.get_editor_property("test_succeeded"):
        finish(False, "data core test did not complete")
        return
    finish(True, f"ticks={state['pie']} datacore=ok")


if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_TASK9_PIE_DRIVER_STARTED")
