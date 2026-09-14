import math
import unreal


BOOTSTRAP_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
MAX_STARTUP_TICKS = 600
MOVEMENT_TICKS = 120
MIN_MOVEMENT_DISTANCE = 10.0

level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
unreal_editor = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
state = {
    "ticks": 0,
    "movement_ticks": 0,
    "start": None,
    "finished": False,
    "end_requested": False,
}
callback_handle = None


def distance(a, b):
    return math.sqrt(
        (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2
    )


def finish(success, message):
    state["finished"] = True
    if success:
        unreal.log(f"BLA_PIE_VERIFY_OK {message}")
    else:
        unreal.log_error(f"BLA_PIE_VERIFY_FAILED {message}")

    if level_editor.is_in_play_in_editor():
        state["end_requested"] = True
        level_editor.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(callback_handle)
        unreal.SystemLibrary.quit_editor()


def tick(_delta_seconds):
    state["ticks"] += 1

    if state["finished"]:
        if state["end_requested"] and not level_editor.is_in_play_in_editor():
            unreal.unregister_slate_post_tick_callback(callback_handle)
            unreal.SystemLibrary.quit_editor()
        return

    if not level_editor.is_in_play_in_editor():
        if state["ticks"] >= MAX_STARTUP_TICKS:
            finish(False, "PIE did not start")
        return

    game_world = unreal_editor.get_game_world()
    if game_world is None:
        return

    game_mode = unreal.GameplayStatics.get_game_mode(game_world)
    if game_mode is None:
        return
    if not isinstance(game_mode, unreal.BLAGameMode):
        finish(False, f"default map game mode={game_mode}")
        return

    pawn = unreal.GameplayStatics.get_player_pawn(game_world, 0)
    if pawn is None:
        if state["ticks"] >= MAX_STARTUP_TICKS * 2:
            finish(False, "player pawn did not spawn")
        return
    if not isinstance(pawn, unreal.BLACharacterBase):
        finish(False, f"player pawn class={pawn.get_class().get_name()}")
        return

    if state["start"] is None:
        state["start"] = pawn.get_actor_location()

    pawn.add_movement_input(pawn.get_actor_forward_vector(), 1.0, True)
    state["movement_ticks"] += 1

    if state["movement_ticks"] < MOVEMENT_TICKS:
        return

    end = pawn.get_actor_location()
    moved = distance(state["start"], end)
    finish(
        moved >= MIN_MOVEMENT_DISTANCE,
        f"pawn={pawn.get_name()} moved={moved:.2f}",
    )


if not level_editor.load_level(BOOTSTRAP_LEVEL):
    raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")

callback_handle = unreal.register_slate_post_tick_callback(tick)
level_editor.editor_request_begin_play()
unreal.log("BLA_PIE_VERIFY_STARTED")
