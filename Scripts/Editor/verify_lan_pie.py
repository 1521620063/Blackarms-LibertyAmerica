import unreal

MATCH_MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
MENU_MAP = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
MAX_TICKS = 18000

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
original_play = unreal.BLALanStatics.capture_pie_play_settings()
if not original_play:
    raise RuntimeError("PIE play settings unavailable")

state = {
    "ticks": 0,
    "phase": "boot",
    "wait": 0,
    "ending": False,
    "health_before": None,
    "markers": [],
    "rpc_wait": 0,
    "rpc_sent": False,
    "extra_pc": None,
}
handle = None


def restore_play_settings():
    if not unreal.BLALanStatics.restore_pie_play_settings(original_play):
        unreal.log_error("BLA_LAN_PIE_SETTINGS_RESTORE_FAILED")


def finish(success, message):
    restore_play_settings()
    log = unreal.log if success else unreal.log_error
    suffix = "OK" if success else "FAILED"
    log("BLA_LAN_PIE_DRIVER_%s %s markers=%s" % (suffix, message, ",".join(state["markers"])))
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def mark(name):
    if name not in state["markers"]:
        state["markers"].append(name)
        unreal.log(name)


def set_listen_play():
    if not unreal.BLALanStatics.configure_pie_play_settings(True, 2):
        raise RuntimeError("listen PIE settings unavailable")


def set_standalone_play():
    if not unreal.BLALanStatics.configure_pie_play_settings(False, 1):
        raise RuntimeError("standalone PIE settings unavailable")


def set_team_size(size):
    unreal.BLALanStatics.apply_lan_selection_to_game_instances(size, MATCH_MAP)
    for world in get_worlds():
        gi = unreal.GameplayStatics.get_game_instance(world)
        if gi:
            gi.set_editor_property("selected_mode", unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE)


def weapon_slot_of(world):
    pawn = unreal.GameplayStatics.get_player_pawn(world, 0) if world else None
    component = prop(pawn, "weapon_component") if pawn else None
    if component is None:
        return None
    return component.get_current_weapon_slot()


def remote_weapon_slot_of(world):
    host_pawn = unreal.GameplayStatics.get_player_pawn(world, 0) if world else None
    for pawn in unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLACharacterBase):
        if pawn == host_pawn or isinstance(pawn, unreal.BLABotCharacter):
            continue
        component = prop(pawn, "weapon_component")
        if component is not None:
            return component.get_current_weapon_slot()
    return None


def objective_manager_of(world):
    managers = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLAObjectiveManager)
    return managers[0] if managers else None


def remote_client_pawn_of(world):
    host_pawn = unreal.GameplayStatics.get_player_pawn(world, 0) if world else None
    for pawn in unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLACharacterBase):
        if pawn == host_pawn or isinstance(pawn, unreal.BLABotCharacter):
            continue
        return pawn
    return None


def get_worlds():
    return list(unreal.BLALanStatics.get_play_worlds())


def split_worlds(worlds):
    listen = None
    client = None
    fallback_listen = None
    for world in worlds:
        gm = unreal.GameplayStatics.get_game_mode(world)
        if isinstance(gm, unreal.BLAGameModeElimination):
            listen = world
        elif gm and fallback_listen is None:
            fallback_listen = world
        else:
            client = world
    if listen is None:
        listen = fallback_listen
    return listen, client


def get_lan_gm(world):
    gm = unreal.GameplayStatics.get_game_mode(world) if world else None
    if isinstance(gm, unreal.BLAGameModeElimination):
        return gm
    return gm


def get_pc(world):
    return unreal.GameplayStatics.get_player_controller(world, 0)


def get_gs(world):
    return unreal.GameplayStatics.get_game_state(world)


def prop(obj, name, default=None):
    if obj is None:
        return default
    try:
        return obj.get_editor_property(name)
    except Exception:
        return default


def describe_player_states(world, label):
    if world is None:
        return '%s=None' % label
    actors = list(unreal.GameplayStatics.get_all_actors_of_class(world, unreal.PlayerState))
    parts = []
    for ps in actors:
        class_name = ps.get_class().get_name() if ps.get_class() else 'None'
        parts.append('name=%s class=%s team=%s host=%s' % (
            ps.get_name(),
            class_name,
            prop(ps, 'team'),
            prop(ps, 'is_lan_host'),
        ))
    return '%s(n=%d %s)' % (label, len(parts), '; '.join(parts) if parts else 'empty')


def log_team_diag(listen, client, wait, note):
    gi = unreal.GameplayStatics.get_game_instance(listen) if listen else None
    gs = get_gs(listen)
    unreal.log('BLA_LAN_PIE_TEAM_DIAG wait=%s note=%s gi=%s gs=%s %s %s' % (
        wait,
        note,
        prop(gi, 'selected_team_size'),
        prop(gs, 'attackers_team_size'),
        describe_player_states(listen, 'listen'),
        describe_player_states(client, 'client'),
    ))


def health_of(world):
    pawn = unreal.GameplayStatics.get_player_pawn(world, 0) if world else None
    if pawn is None:
        return None
    component = prop(pawn, "health_component")
    if component is None:
        return None
    return prop(component, "current_health")


def begin_listen(team_size, next_phase):
    if not level.load_level(MATCH_MAP):
        finish(False, "failed to load match map")
        return
    state["listen_team_size"] = team_size
    state["s2_start_sent"] = False
    set_team_size(team_size)
    set_listen_play()
    state["phase"] = next_phase
    state["wait"] = 0
    state["rpc_wait"] = 0
    level.editor_request_begin_play()
    set_team_size(team_size)


def begin_standalone():
    if not level.load_level(MENU_MAP):
        finish(False, "failed to load menu map")
        return
    set_team_size(1)
    set_standalone_play()
    state["phase"] = "standalone_play"
    state["wait"] = 0
    level.editor_request_begin_play()


def request_end(next_phase):
    state["phase"] = next_phase
    state["wait"] = 0
    if level.is_in_play_in_editor():
        level.editor_request_end_play()


def tick_impl():
    state["ticks"] += 1
    if state["ending"]:
        if not level.is_in_play_in_editor():
            restore_play_settings()
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
        return
    if state["ticks"] >= MAX_TICKS:
        finish(False, "timeout phase=%s" % state["phase"])
        return

    phase = state["phase"]
    if phase == "boot":
        begin_listen(1, "s1_wait_worlds")
        return

    if phase in ("s1_end", "s2_end"):
        if not level.is_in_play_in_editor():
            if phase == "s1_end":
                begin_listen(2, "s2_wait_worlds")
            else:
                begin_standalone()
        return

    if not level.is_in_play_in_editor():
        state["wait"] += 1
        if state["wait"] > 600:
            finish(False, "PIE did not start phase=%s" % phase)
        return

    worlds = get_worlds()
    listen, client = split_worlds(worlds)

    if phase == "s1_wait_worlds":
        if listen is None or client is None:
            return
        gs = get_gs(listen)
        if prop(gs, "round_phase") != unreal.BLA_RoundPhase.WAITING:
            return
        bots = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLABotCharacter)
        if len(bots) != 0:
            finish(False, "waiting spawned bots")
            return
        mark("BLA_LAN_PIE_WAITING_OK")
        state["phase"] = "s1_join"
        return

    if phase == "s1_join":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        client_pc = get_pc(client)
        client_ps = client_pc.player_state if client_pc else None
        if gm is None or client_ps is None:
            return
        if gm.count_humans() < 2:
            return
        if prop(client_ps, "team") != unreal.BLA_Team.NEUTRAL:
            finish(False, "joiner was not Neutral")
            return
        mark("BLA_LAN_PIE_JOIN_OK")
        state["phase"] = "s1_team"
        return

    if phase == "s1_team":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        host_pc = get_pc(listen)
        client_pc = get_pc(client)
        host_ps = host_pc.player_state if host_pc else None
        client_ps = client_pc.player_state if client_pc else None
        if gm is None or host_ps is None or client_ps is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            gm.set_lan_team(host_pc, unreal.BLA_Team.ATTACKERS)
            client_pc.client_debug_request_team(unreal.BLA_Team.ATTACKERS)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        if wait == 3:
            if prop(client_ps, "team") == unreal.BLA_Team.ATTACKERS:
                finish(False, "second attacker was accepted at TeamSize=1")
                return
            log_team_diag(listen, client, wait, "request-defenders")
            client_pc.client_debug_request_team(unreal.BLA_Team.DEFENDERS)
            state["rpc_wait"] = 4
            return
        client_team = prop(client_ps, "team")
        if client_team != unreal.BLA_Team.DEFENDERS:
            if wait in (4, 10, 30, 60, 90, 110, 120, 180, 240, 360, 480, 599) or wait % 60 == 0:
                log_team_diag(listen, client, wait, "waiting-client=%s" % client_team)
            if wait < 600:
                state["rpc_wait"] = wait + 1
                return
            log_team_diag(listen, client, wait, "timeout-client=%s" % client_team)
            finish(False, "team pick failed wait=%s client=%s" % (wait, client_team))
            return
        log_team_diag(listen, client, wait, "replicated-client=%s" % client_team)
        mark("BLA_LAN_PIE_TEAM_OK")
        state["phase"] = "s1_full"
        state["rpc_wait"] = 0
        return

    if phase == "s1_full":
        gm = get_lan_gm(listen)
        if gm is None:
            return
        if not isinstance(gm, unreal.BLAGameModeElimination):
            finish(False, "s1_full gm=%s" % gm.get_class().get_name())
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            state["extra_pc"] = unreal.GameplayStatics.create_player(listen, 2, True)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        accepted = gm.can_accept_lan_join()
        humans = gm.count_humans()
        extra = state.get("extra_pc")
        if extra:
            unreal.GameplayStatics.remove_player(extra, True)
            state["extra_pc"] = None
        if accepted or humans != 2:
            finish(False, "third join not rejected humans=%s accepted=%s" % (humans, accepted))
            return
        mark("BLA_LAN_PIE_FULL_REJECT_OK")
        state["phase"] = "s1_not_host"
        state["rpc_wait"] = 0
        return

    if phase == "s1_not_host":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        gs = get_gs(listen)
        client_pc = get_pc(client)
        client_gi = unreal.GameplayStatics.get_game_instance(client)
        if gm is None or gs is None or client_pc is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            client_pc.client_debug_request_start_lan_match()
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        still_waiting = prop(gs, "round_phase") == unreal.BLA_RoundPhase.WAITING
        error = str(prop(client_gi, "last_flow_error", ""))
        if not still_waiting:
            finish(False, "non-host start left Waiting")
            return
        if "FLOW_LAN_NOT_HOST" not in error:
            if wait < 30:
                state["rpc_wait"] = wait + 1
                return
            finish(False, "non-host start missing FLOW_LAN_NOT_HOST")
            return
        mark("BLA_LAN_PIE_NOT_HOST_OK")
        state["phase"] = "s1_host_left"
        state["rpc_wait"] = 0
        return

    if phase == "s1_host_left":
        listen_gi = unreal.GameplayStatics.get_game_instance(listen) if listen else None
        client_gi = unreal.GameplayStatics.get_game_instance(client) if client else None
        if listen_gi is None:
            return
        listen_gi.request_leave_lan()
        state["phase"] = "s1_host_left_wait"
        state["wait"] = 0
        return

    if phase == "s1_host_left_wait":
        state["wait"] += 1
        client_gi = unreal.GameplayStatics.get_game_instance(client) if client else None
        error = str(prop(client_gi, "last_flow_error", "")) if client_gi else ""
        client_map = client.get_path_name() if client else ""
        left = ("FLOW_LAN_HOST_LEFT" in error) or ("L_TestBootstrap" in client_map) or (client is None)
        if left:
            mark("BLA_LAN_PIE_HOST_LEFT_OK")
            request_end("s1_end")
            return
        if state["wait"] > 600:
            finish(False, "host leave did not return client")
        return

    if phase == "s2_wait_worlds":
        desired = state.get("listen_team_size", 2)
        if listen is None or client is None:
            set_team_size(desired)
            return
        gs = get_gs(listen)
        gm = unreal.GameplayStatics.get_game_mode(listen)
        if prop(gs, "round_phase") != unreal.BLA_RoundPhase.WAITING or gm is None:
            set_team_size(desired)
            return
        gi = unreal.GameplayStatics.get_game_instance(listen)
        gi_size = prop(gi, "selected_team_size")
        gs_size = prop(gs, "attackers_team_size")
        if gi_size != desired or gs_size != desired:
            set_team_size(desired)
            wait = state.get("wait", 0) + 1
            state["wait"] = wait
            if wait in (1, 10, 30, 60, 90, 120, 180) or wait % 30 == 0:
                log_team_diag(listen, client, wait, "s2-size gi=%s gs=%s" % (gi_size, gs_size))
            if wait > 180:
                finish(False, "s2 team_size gi=%s gs=%s" % (gi_size, gs_size))
            return
        if gm.count_humans() < 2:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            host_pc = get_pc(listen)
            client_pc = get_pc(client)
            gm.set_lan_team(host_pc, unreal.BLA_Team.DEFENDERS)
            client_pc.client_debug_request_team(unreal.BLA_Team.ATTACKERS)
            log_team_diag(listen, client, wait, "s2-request-attacker-client")
            state["rpc_wait"] = 1
            return
        client_pc = get_pc(client)
        client_ps = client_pc.player_state if client_pc else None
        client_team = prop(client_ps, "team")
        if client_team != unreal.BLA_Team.ATTACKERS:
            if wait in (1, 10, 30, 60, 90, 110, 120, 180, 240, 360, 480, 599) or wait % 60 == 0:
                log_team_diag(listen, client, wait, "s2-waiting-client=%s" % client_team)
            if wait < 600:
                state["rpc_wait"] = wait + 1
                return
            log_team_diag(listen, client, wait, "s2-timeout-client=%s" % client_team)
            finish(False, "s2 team pick failed wait=%s client=%s" % (wait, client_team))
            return
        log_team_diag(listen, client, wait, "s2-replicated-client=%s" % client_team)
        state["phase"] = "s2_start"
        state["wait"] = 0
        state["rpc_wait"] = 0
        return

    if phase == "s2_start":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        gs = get_gs(listen)
        host_pc = get_pc(listen)
        client_ps = get_pc(client).player_state if get_pc(client) else None
        if gm is None or host_pc is None or client_ps is None:
            return
        wait = state.get("rpc_wait", 0)
        if not state.get("s2_start_sent"):
            client_team = prop(client_ps, "team")
            if client_team != unreal.BLA_Team.ATTACKERS:
                if wait in (0, 10, 30, 60, 90, 120, 180, 240, 360, 480, 599) or wait % 60 == 0:
                    log_team_diag(listen, client, wait, "s2-start-waiting-client=%s" % client_team)
                if wait < 600:
                    state["rpc_wait"] = wait + 1
                    return
                log_team_diag(listen, client, wait, "s2-start-timeout-client=%s" % client_team)
                finish(False, "s2 team pick failed wait=%s client=%s" % (wait, client_team))
                return
            gm.start_lan_match(host_pc)
            state["s2_start_sent"] = True
            state["rpc_wait"] = 1
            state["wait"] = 0
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        state["wait"] += 1
        if prop(gs, "round_phase") == unreal.BLA_RoundPhase.WAITING:
            if state["wait"] < 180:
                return
            finish(False, "start did not leave Waiting")
            return
        bots = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLABotCharacter)
        units = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLACharacterBase)
        if len(bots) != 2 or len(units) != 4:
            if state["wait"] < 180:
                return
            finish(False, "start fill failed bots=%s total=%s" % (len(bots), len(units)))
            return
        mark("BLA_LAN_PIE_START_OK")
        state["phase"] = "s2_weapon"
        state["wait"] = 0
        state["rpc_wait"] = 0
        return

    if phase == "s2_weapon":
        server_slot = remote_weapon_slot_of(listen)
        client_slot = weapon_slot_of(client)
        client_pc = get_pc(client)
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            state["rpc_wait"] = 1
            client_pc.client_debug_switch_weapon(1)
            return
        if server_slot is None or client_slot is None:
            if wait < 120:
                state["rpc_wait"] = wait + 1
                return
            finish(False, "weapon slots unavailable server=%s client=%s" % (server_slot, client_slot))
            return
        if server_slot != 1 or client_slot != 1:
            if wait < 120:
                state["rpc_wait"] = wait + 1
                return
            finish(False, "weapon switch desync server=%s client=%s" % (server_slot, client_slot))
            return
        mark("BLA_LAN_PIE_WEAPON_SWITCH_OK")
        state["phase"] = "s2_objective"
        state["wait"] = 0
        state["rpc_wait"] = 0
        state["objective_teleported"] = False
        return

    if phase == "s2_objective":
        manager = objective_manager_of(listen)
        pawn = remote_client_pawn_of(listen)
        if manager is None or pawn is None:
            return
        if not state.get("objective_teleported"):
            core_list = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLADataCore)
            if not core_list:
                return
            location = core_list[0].get_actor_location()
            offset = location.__class__(location.x + 80.0, location.y, location.z)
            pawn.set_actor_location(offset, False, True)
            state["objective_teleported"] = True
        round_phase = prop(get_gs(listen), "round_phase")
        if round_phase != unreal.BLA_RoundPhase.COMBAT:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            state["rpc_wait"] = 1
            get_pc(client).client_debug_request_objective_interaction(0)
            return
        objective_state = prop(manager, "objective_state")
        if objective_state == unreal.BLA_ObjectiveState.CARRIED:
            mark("BLA_LAN_PIE_OBJECTIVE_RPC_OK")
            state["phase"] = "s2_started_reject"
            state["wait"] = 0
            state["rpc_wait"] = 0
            state["health_before"] = None
            return
        if wait in (10, 40, 80):
            get_pc(client).client_debug_request_objective_interaction(0)
        if wait < 120:
            state["rpc_wait"] = wait + 1
            return
        finish(False, "client objective pickup failed state=%s" % objective_state)
        return

    if phase == "s2_started_reject":
        gm = get_lan_gm(listen)
        if gm is None:
            return
        if not isinstance(gm, unreal.BLAGameModeElimination):
            finish(False, "s2_started_reject gm=%s" % gm.get_class().get_name())
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            state["extra_pc"] = unreal.GameplayStatics.create_player(listen, 2, True)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        accepted = gm.can_accept_lan_join()
        extra = state.get("extra_pc")
        if extra:
            unreal.GameplayStatics.remove_player(extra, True)
            state["extra_pc"] = None
        if accepted:
            finish(False, "join after start was accepted")
            return
        mark("BLA_LAN_PIE_STARTED_REJECT_OK")
        state["phase"] = "s2_damage"
        state["wait"] = 0
        state["rpc_wait"] = 0
        return

    if phase == "s2_damage":
        client_pc = get_pc(client)
        hp = health_of(client)
        if hp is None:
            return
        if state["health_before"] is None:
            state["health_before"] = hp
            client_pc.client_debug_try_local_damage(999.0)
            return
        wait = state.get("rpc_wait", 0)
        if hp != 0.0:
            if wait < 120:
                state["rpc_wait"] = wait + 1
                return
            finish(False, "server damage did not kill client hp=%s" % hp)
            return
        spectator = client_pc.is_in_team_spectator_mode() if client_pc else False
        target = client_pc.get_spectator_target() if client_pc else None
        if spectator and target is not None:
            mark("BLA_LAN_PIE_CLIENT_DAMAGE_OK")
            request_end("s2_end")
            return
        if wait < 180:
            state["rpc_wait"] = wait + 1
            return
        finish(False, "client death spectator failed mode=%s target=%s" % (spectator, target))
        return

    if phase == "standalone_play":
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
        if world is None:
            return
        gi = unreal.GameplayStatics.get_game_instance(world)
        if not state.get("rpc_sent"):
            gi.set_editor_property("match_map_path", MATCH_MAP)
            gi.request_start_match()
            state["rpc_sent"] = True
            travel = str(prop(gi, "last_travel_request", ""))
            if "?listen" in travel:
                finish(False, "standalone travel had listen url=%s" % travel)
                return
            return
        travel = str(prop(gi, "last_travel_request", ""))
        if "?listen" in travel:
            finish(False, "standalone travel had listen url=%s" % travel)
            return
        state["phase"] = "standalone_wait"
        state["wait"] = 0
        return

    if phase == "standalone_wait":
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
        if world is None:
            return
        gs = get_gs(world)
        gm = unreal.GameplayStatics.get_game_mode(world)
        if gs is None:
            return
        phase_now = prop(gs, "round_phase")
        if phase_now == unreal.BLA_RoundPhase.WAITING:
            finish(False, "standalone entered Waiting")
            return
        if phase_now in (unreal.BLA_RoundPhase.PREPARATION, unreal.BLA_RoundPhase.COMBAT):
            if gm is not None:
                mark("BLA_LAN_PIE_STANDALONE_OK")
                required = [
                    "BLA_LAN_PIE_WAITING_OK",
                    "BLA_LAN_PIE_JOIN_OK",
                    "BLA_LAN_PIE_TEAM_OK",
                    "BLA_LAN_PIE_FULL_REJECT_OK",
                    "BLA_LAN_PIE_NOT_HOST_OK",
                    "BLA_LAN_PIE_START_OK",
                    "BLA_LAN_PIE_WEAPON_SWITCH_OK",
                    "BLA_LAN_PIE_OBJECTIVE_RPC_OK",
                    "BLA_LAN_PIE_STARTED_REJECT_OK",
                    "BLA_LAN_PIE_CLIENT_DAMAGE_OK",
                    "BLA_LAN_PIE_HOST_LEFT_OK",
                    "BLA_LAN_PIE_STANDALONE_OK",
                ]
                missing = [name for name in required if name not in state["markers"]]
                if missing:
                    finish(False, "missing %s" % ",".join(missing))
                    return
                finish(True, "sessions=3")
                return
        state["wait"] += 1
        if state["wait"] > 900:
            finish(False, "standalone did not start phase=%s" % phase_now)
        return


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        finish(False, "driver_error %s" % error)


handle = unreal.register_slate_post_tick_callback(tick)
unreal.log("BLA_LAN_PIE_DRIVER_STARTED")
