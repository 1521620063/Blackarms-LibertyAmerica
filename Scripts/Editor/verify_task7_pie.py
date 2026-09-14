import unreal


MAP = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"
MAX_STARTUP_TICKS = 600
VALIDATION_TICKS = 240

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie": 0, "ending": False}
handle = None


def finish(success, message):
    if success:
        unreal.log(f"BLA_TASK7_PIE_DRIVER_OK {message}")
    else:
        unreal.log_error(f"BLA_TASK7_PIE_DRIVER_FAILED {message}")
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
    game_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    if game_world is None:
        return
    game_mode = unreal.GameplayStatics.get_game_mode(game_world)
    if game_mode is None:
        return
    if not isinstance(game_mode, unreal.BLAGameModeElimination):
        finish(False, f"1v1 map game mode={game_mode}")
        return
    state["pie"] += 1
    if state["pie"] >= VALIDATION_TICKS:
        finish(True, f"ticks={state['pie']} game_mode=elimination")


if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_TASK7_PIE_DRIVER_STARTED")
