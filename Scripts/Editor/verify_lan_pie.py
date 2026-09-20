import unreal


MAP = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
MAX_TICKS = 600

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "ran": False, "ending": False}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"BLA_LAN_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
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
        if state["ticks"] >= MAX_TICKS:
            finish(False, "PIE did not start")
        return

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    tests = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLALanFlowTest) if world else []
    if not tests:
        if state["ticks"] >= MAX_TICKS:
            finish(False, "BLALanFlowTest missing")
        return
    test = tests[0]
    if not state["ran"]:
        test.run_address_contracts()
        state["ran"] = True
        return
    if test.get_editor_property("test_failed"):
        finish(False, "address contracts failed")
    elif test.get_editor_property("test_succeeded"):
        finish(True, "cases=7 listen=1 offline_clean=1")


if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_LAN_PIE_DRIVER_STARTED")
