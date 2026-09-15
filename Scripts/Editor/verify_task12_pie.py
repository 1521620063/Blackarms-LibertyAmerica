import os

import unreal


MENU_MAP = "L_TestBootstrap"
FINAL_MAP = "L_BLA_ZeroFacility"
MODE = os.environ.get("BLA_TASK12_MODE", "data_core").strip().lower()
TEAM_SIZE = max(1, min(3, int(os.environ.get("BLA_TASK12_SIZE", "3"))))
DIFFICULTY = os.environ.get("BLA_TASK12_DIFFICULTY", "hard").strip().lower()
MAX_TICKS = 3000

DIFFICULTIES = {
    "easy": unreal.BLA_DifficultyLevel.EASY,
    "normal": unreal.BLA_DifficultyLevel.NORMAL,
    "hard": unreal.BLA_DifficultyLevel.HARD,
}

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "requested": False, "returned": False, "ending": False}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"BLA_TASK12_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def get_world():
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()


def tick_impl():
    state["ticks"] += 1
    if state["ending"]:
        if not level.is_in_play_in_editor():
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
        return
    if not level.is_in_play_in_editor():
        if state["ticks"] >= 600:
            finish(False, "PIE did not start")
        return
    game_world = get_world()
    if game_world is None:
        return
    map_path = game_world.get_path_name()

    if not state["requested"]:
        harnesses = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLATestHarness)
        if not harnesses:
            return
        harnesses[0].run_configuration(
            unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE if MODE == "data_core" else unreal.BLA_MatchMode.TEAM_ELIMINATION,
            TEAM_SIZE,
            DIFFICULTIES.get(DIFFICULTY, unreal.BLA_DifficultyLevel.NORMAL))
        state["requested"] = True
        unreal.log(f"BLA_TASK12_PIE_HARNESS_STARTED mode={MODE} size={TEAM_SIZE} difficulty={DIFFICULTY}")
        return

    for harness in unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLATestHarness):
        if harness.get_editor_property("has_result"):
            result = str(harness.get_editor_property("last_result"))
            if not result.startswith("OK"):
                finish(False, f"flows failed result={result}")
                return
            events = harness.get_editor_property("flows_event_count")
            if events < 1:
                finish(False, f"flows event missing in debug subsystem events={events}")
                return
            finish(True, f"mode={MODE} size={TEAM_SIZE} difficulty={DIFFICULTY} result={result} flows_events={events}")
            return
    if state["ticks"] >= MAX_TICKS:
        finish(False, f"harness did not finish map={map_path}")


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        finish(False, f"driver_error {error}")


if not level.load_level("/Game/BLA/Maps/Graybox/L_TestBootstrap"):
    raise RuntimeError("Failed to load the menu map")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_TASK12_PIE_DRIVER_STARTED")
