import unreal


MAP = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
VALIDATOR_CLASS = unreal.BLACharacterFoundationValidator
VALIDATOR_LABEL = "BLA Character Foundation Validator"
MAX_STARTUP_TICKS = 600
MAX_VALIDATION_TICKS = 300

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie": 0, "ending": False}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"BLA_TASK3_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def read_flags(validator):
    return (
        validator.get_editor_property("validation_succeeded"),
        validator.get_editor_property("validation_failed"),
    )


def tick(_delta_seconds):
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
    game_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    validators = (
        unreal.GameplayStatics.get_all_actors_of_class(game_world, VALIDATOR_CLASS)
        if game_world
        else []
    )
    succeeded = False
    failed = False
    for validator in validators:
        validator_succeeded, validator_failed = read_flags(validator)
        succeeded = succeeded or validator_succeeded
        failed = failed or validator_failed
    if failed:
        finish(False, f"validator_failed label={VALIDATOR_LABEL} count={len(validators)}")
        return
    if succeeded:
        finish(True, f"ticks={state['pie']} validator=ok label={VALIDATOR_LABEL}")
        return
    if state["pie"] >= MAX_VALIDATION_TICKS:
        finish(False, f"validator_incomplete label={VALIDATOR_LABEL} count={len(validators)}")


if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_TASK3_PIE_DRIVER_STARTED")
