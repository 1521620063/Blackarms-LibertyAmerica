import unreal
level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie": 0, "end": False}; handle = None
def tick(_):
    state["ticks"] += 1
    if state["end"]:
        if not level.is_in_play_in_editor(): unreal.unregister_slate_post_tick_callback(handle); unreal.SystemLibrary.quit_editor()
        return
    if level.is_in_play_in_editor():
        state["pie"] += 1
        if state["pie"] >= 180: unreal.log("FPS_TASK6_PIE_DRIVER_OK ticks=180"); state["end"] = True; level.editor_request_end_play()
    elif state["ticks"] >= 600: unreal.log_error("FPS_TASK6_PIE_DRIVER_FAILED start"); state["end"] = True; unreal.SystemLibrary.quit_editor()
level.load_level("/Game/FPS/Maps/Graybox/L_TestBootstrap"); handle = unreal.register_slate_post_tick_callback(tick); level.editor_request_begin_play()
