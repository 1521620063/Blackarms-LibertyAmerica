import unreal


BOOTSTRAP_LEVEL = "/Game/FPS/Maps/Graybox/L_TestBootstrap"
MAX_STARTUP_TICKS = 600
VALIDATION_TICKS = 150

level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie_ticks": 0, "ending": False}
callback_handle = None


def finish(success, message):
    if success:
        unreal.log(f"FPS_TASK5_PIE_DRIVER_OK {message}")
    else:
        unreal.log_error(f"FPS_TASK5_PIE_DRIVER_FAILED {message}")
    state["ending"] = True
    if level_editor.is_in_play_in_editor():
        level_editor.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(callback_handle)
        unreal.SystemLibrary.quit_editor()


def tick(_delta_seconds):
    state["ticks"] += 1
    if state["ending"]:
        if not level_editor.is_in_play_in_editor():
            unreal.unregister_slate_post_tick_callback(callback_handle)
            unreal.SystemLibrary.quit_editor()
        return
    if not level_editor.is_in_play_in_editor():
        if state["ticks"] >= MAX_STARTUP_TICKS:
            finish(False, "PIE did not start")
        return
    state["pie_ticks"] += 1
    if state["pie_ticks"] >= VALIDATION_TICKS:
        finish(True, f"ticks={state['pie_ticks']}")


if not level_editor.load_level(BOOTSTRAP_LEVEL):
    raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")

callback_handle = unreal.register_slate_post_tick_callback(tick)
level_editor.editor_request_begin_play()
unreal.log("FPS_TASK5_PIE_DRIVER_STARTED")
