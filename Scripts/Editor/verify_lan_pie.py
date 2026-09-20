import unreal


MENU_MAP = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
MATCH_MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
MATCH_MAP_NAME = "L_BLA_ZeroFacility"
MAX_TICKS = 1200

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {
    "ticks": 0,
    "pie_ticks": 0,
    "host_requested": False,
    "ending": False,
}
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


def tick_impl():
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

    state["pie_ticks"] += 1
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    if world is None:
        return

    map_path = world.get_path_name()
    if not state["host_requested"]:
        game_instance = unreal.GameplayStatics.get_game_instance(world)
        if game_instance is None:
            return
        game_instance.set_editor_property("match_map_path", MATCH_MAP)
        if not game_instance.request_host_lan_match():
            finish(False, "RequestHostLANMatch rejected")
            return
        state["host_requested"] = True
        unreal.log("BLA_LAN_PIE_HOST_REQUESTED listen=1")
        return

    if MATCH_MAP_NAME not in map_path:
        if state["pie_ticks"] >= MAX_TICKS:
            finish(False, f"listen travel did not complete map={map_path}")
        return

    game_state = unreal.GameplayStatics.get_game_state(world)
    if game_state is None:
        return
    phase = game_state.get_editor_property("round_phase")
    bots = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLAAIController)
    if phase == unreal.BLA_RoundPhase.WAITING and len(bots) == 0:
        tests = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLALanFlowTest)
        if tests:
            tests[0].run_waiting_contracts()
        unreal.log("BLA_LAN_WAITING_OK net=listen phase=6 bots=0")
        finish(True, "waiting=1 bots=0 production_host_path=1")
        return
    if phase != unreal.BLA_RoundPhase.LOADING or bots:
        finish(False, f"BLA_LAN_WAITING_FAILED phase={phase} bots={len(bots)}")
    elif state["pie_ticks"] >= MAX_TICKS:
        finish(False, "BLA_LAN_WAITING_FAILED timeout")


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        finish(False, f"driver_error {error}")


if not level.load_level(MENU_MAP):
    raise RuntimeError(f"Failed to load {MENU_MAP}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_LAN_PIE_DRIVER_STARTED")
