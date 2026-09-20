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
        game_instance.set_editor_property("selected_team_size", 1)
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
        waiting_combatants = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLACharacterBase)
        if waiting_combatants:
            names = ",".join(actor.get_name() for actor in waiting_combatants)
            finish(False, f"waiting combat pawn leak count={len(waiting_combatants)} names={names}")
            return
        game_mode = unreal.GameplayStatics.get_game_mode(world)
        host = unreal.GameplayStatics.get_player_controller(world, 0)
        if game_mode is None or host is None:
            finish(False, "join/team missing game mode or host")
            return
        host_defenders = game_mode.set_lan_team(host, unreal.BLA_Team.DEFENDERS)
        host_attackers = game_mode.set_lan_team(host, unreal.BLA_Team.ATTACKERS)
        open_before_join = game_mode.can_accept_lan_join()
        extra = unreal.GameplayStatics.create_player(world, 1, True)
        extra_state = extra.get_editor_property("player_state") if extra else None
        join_neutral = extra_state is not None and extra_state.get_editor_property("team") == unreal.BLA_Team.NEUTRAL
        picked = extra is not None and game_mode.set_lan_team(extra, unreal.BLA_Team.DEFENDERS)
        team_full = not game_mode.set_lan_team(host, unreal.BLA_Team.DEFENDERS)
        roster = game_state.get_editor_property("lan_roster")
        if not (host_defenders and host_attackers and open_before_join and extra and join_neutral and picked and team_full and len(roster) == 2):
            finish(False, f"join/team contracts failed host_def={host_defenders} host_atk={host_attackers} open={open_before_join} extra={bool(extra)} neutral={join_neutral} picked={picked} full={team_full} roster={len(roster)}")
            return
        unreal.log("BLA_LAN_WAITING_OK net=listen phase=6 bots=0")
        unreal.log("BLA_LAN_JOIN_OK accepted=1 team_pick=1 team_full=1 started_reject=0")

        game_instance = unreal.GameplayStatics.get_game_instance(world)
        host_state = host.get_editor_property("player_state")
        if game_instance is None or host_state is None:
            finish(False, "start contracts missing game instance or host state")
            return
        game_instance.set_editor_property("selected_team_size", 2)
        game_state.set_editor_property("attackers_team_size", 2)
        game_state.set_editor_property("defenders_team_size", 2)
        host_state.set_editor_property("team", unreal.BLA_Team.NEUTRAL)
        extra_state.set_editor_property("team", unreal.BLA_Team.NEUTRAL)

        extra.server_start_lan_match()
        still_waiting = game_state.get_editor_property("round_phase") == unreal.BLA_RoundPhase.WAITING
        not_host = "FLOW_LAN_NOT_HOST" in game_instance.get_editor_property("last_flow_error")
        host_started = game_mode.start_lan_match(host)
        phase_prep = game_state.get_editor_property("round_phase") == unreal.BLA_RoundPhase.PREPARATION
        bot_pawns = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLABotCharacter)
        combatants = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLACharacterBase)
        host_team = host_state.get_editor_property("team")
        extra_team = extra_state.get_editor_property("team")
        neutral_ok = host_team == unreal.BLA_Team.ATTACKERS and extra_team == unreal.BLA_Team.DEFENDERS
        started_reject = not game_mode.can_accept_lan_join()
        if not (still_waiting and not_host and host_started and phase_prep and len(bot_pawns) == 2 and len(combatants) == 4 and neutral_ok and started_reject):
            finish(False, f"start contracts failed waiting={still_waiting} not_host={not_host} started={host_started} prep={phase_prep} bots={len(bot_pawns)} total={len(combatants)} neutral={neutral_ok} reject={started_reject}")
            return
        unreal.log("BLA_LAN_NEUTRAL_OK host=0 extra=1")
        unreal.log(f"BLA_LAN_START_OK not_host=1 bots={len(bot_pawns)} total={len(combatants)} started_reject=1")

        victim = bot_pawns[0] if bot_pawns else None
        server_damage = bool(victim and victim.apply_combat_damage(15.0, "Body", None))
        health_component = victim.get_editor_property("health_component") if victim else None
        health_after_server = health_component.get_editor_property("current_health") if health_component else -1.0
        humans_before = game_mode.count_humans()
        bots_before = len(unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLABotCharacter))
        unreal.GameplayStatics.remove_player(extra, True)
        humans_after_leave = game_mode.count_humans()
        bots_after_leave = len(unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLABotCharacter))
        game_mode.fill_vacant_lan_slots_with_bots()
        bots_after_fill = len(unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLABotCharacter))
        authority_ok = (
            server_damage
            and health_after_server < 100.0
            and humans_after_leave == humans_before - 1
            and bots_after_leave == bots_before
            and bots_after_fill == bots_before + 1
        )
        if not authority_ok:
            finish(False, f"BLA_LAN_AUTHORITY_FAILED dmg={server_damage} health={health_after_server} humans={humans_before}/{humans_after_leave} bots={bots_before}/{bots_after_leave}/{bots_after_fill}")
            return
        unreal.log("BLA_LAN_AUTHORITY_OK damage_server=1 leave_empty_slot=1 next_round_fill=1")
        finish(True, "waiting=1 join=1 team_full=1 start=1 neutral=1 authority=1 production_host_path=1")
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
