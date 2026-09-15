import math
import os

import unreal


MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
MATCHES = 5
MATCH_STARTUP_TICKS = 900
MATCH_TICKS = 900

MODE = os.environ.get("BLA_TASK11_SOAK_MODE", "elimination").strip().lower()
TEAM_SIZE = max(1, min(3, int(os.environ.get("BLA_TASK11_SOAK_SIZE", "1"))))
IS_DATA_CORE = MODE == "data_core"

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {
    "ticks": 0,
    "match_index": 0,
    "match_tick": 0,
    "match": None,
    "results": [],
    "finished": False,
}
handle = None


def fail(message):
    unreal.log_error(f"BLA_TASK11_SOAK_FAILED mode={'data_core' if IS_DATA_CORE else 'elimination'} "
                     f"size={TEAM_SIZE} {message}")
    state["finished"] = True
    unreal.unregister_slate_post_tick_callback(handle)
    unreal.SystemLibrary.quit_editor()


def get_world():
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()


def start_match_metrics():
    return {
        "first_contact": None,
        "objective_states": set(),
        "stuck_ticks": 0,
        "start_positions": {},
        "route_hits": set(),
        "directive_targets": set(),
        "recovery_points": set(),
        "latest_zone": "",
        "latest_tactical_point": "",
        "no_displacement_ticks": 0,
        "recovery_count": 0,
        "last_positions": {},
        "last_recovery_by_bot": {},
        "reset_count": 0,
        "preparation_ticks": 0,
        "carried_ticks": 0,
        "planting_ticks": 0,
        "planted_ticks": 0,
        "uploading_ticks": 0,
        "completed_ticks": 0,
        "cancel_reasons": set(),
    }


def collect(game_world, metrics, tick):
    bots = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLABotCharacter)
    if not metrics["start_positions"] and bots:
        metrics["start_positions"] = {bot.get_path_name(): bot.get_actor_location() for bot in bots}
    zones = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAMapZone)
    for bot in bots:
        location = bot.get_actor_location()
        bot_key = bot.get_path_name()
        previous = metrics["last_positions"].get(bot_key)
        if previous is not None:
            moved = math.sqrt(
                (location.x - previous.x) ** 2 + (location.y - previous.y) ** 2 + (location.z - previous.z) ** 2)
            if moved < 5.0:
                metrics["no_displacement_ticks"] += 1
        metrics["last_positions"][bot_key] = location
        for zone in zones:
            if zone.contains_location(location):
                zone_name = str(zone.get_editor_property("zone_name"))
                metrics["route_hits"].add(zone_name)
                metrics["latest_zone"] = zone_name
        controller = bot.get_controller()
        if isinstance(controller, unreal.BLAAIController):
            if controller.get_editor_property("is_stuck"):
                metrics["stuck_ticks"] += 1
            directive = controller.get_editor_property("directive_target")
            if directive is not None:
                metrics["directive_targets"].add(directive.get_name())
                metrics["latest_tactical_point"] = directive.get_name()
            recovery_point = controller.get_editor_property("last_recovery_point")
            if recovery_point is not None:
                recovery_name = recovery_point.get_name()
                metrics["recovery_points"].add(recovery_name)
                if metrics["last_recovery_by_bot"].get(bot_key) != recovery_name:
                    metrics["recovery_count"] += 1
                    metrics["last_recovery_by_bot"][bot_key] = recovery_name
            perception = controller.get_editor_property("bot_perception")
            target = perception.get_editor_property("target_actor") if perception else None
            if target is not None and metrics["first_contact"] is None:
                metrics["first_contact"] = tick
    for manager in unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAObjectiveManager):
        metrics["objective_states"].add(str(manager.get_editor_property("objective_state")))
        metrics["reset_count"] = int(manager.get_editor_property("reset_count") or 0)
        metrics["preparation_ticks"] = int(manager.get_editor_property("preparation_ticks") or 0)
        metrics["carried_ticks"] = int(manager.get_editor_property("carried_ticks") or 0)
        metrics["planting_ticks"] = int(manager.get_editor_property("planting_ticks") or 0)
        metrics["planted_ticks"] = int(manager.get_editor_property("planted_ticks") or 0)
        metrics["uploading_ticks"] = int(manager.get_editor_property("uploading_ticks") or 0)
        metrics["completed_ticks"] = int(manager.get_editor_property("completed_ticks") or 0)
        for reason in manager.get_editor_property("cancel_reasons") or []:
            name = str(reason)
            if name:
                metrics["cancel_reasons"].add(name)


def finish_match(game_world, metrics):
    bots = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLABotCharacter)
    moved = 0.0
    for bot in bots:
        start = metrics["start_positions"].get(bot.get_path_name())
        if start is None:
            continue
        current = bot.get_actor_location()
        moved = max(moved, math.sqrt(
            (current.x - start.x) ** 2 + (current.y - start.y) ** 2 + (current.z - start.z) ** 2))
    score = "0-0"
    round_number = 0
    game_state = unreal.GameplayStatics.get_game_state(game_world)
    if game_state:
        score = f"{game_state.get_editor_property('attackers_score')}-{game_state.get_editor_property('defenders_score')}"
        round_number = game_state.get_editor_property("current_round")
    return {
        "first_contact": metrics["first_contact"],
        "routes": sorted(metrics["route_hits"]),
        "stuck_ticks": metrics["stuck_ticks"],
        "moved": round(moved, 1),
        "score": score,
        "round": round_number,
        "objective_states": sorted(metrics["objective_states"]),
        "directive_targets": sorted(metrics["directive_targets"]),
        "recovery_points": sorted(metrics["recovery_points"]),
        "latest_zone": metrics["latest_zone"],
        "latest_tactical_point": metrics["latest_tactical_point"],
        "no_displacement_ticks": metrics["no_displacement_ticks"],
        "recovery_count": metrics["recovery_count"],
        "reset_count": metrics["reset_count"],
        "preparation_ticks": metrics["preparation_ticks"],
        "carried_ticks": metrics["carried_ticks"],
        "planting_ticks": metrics["planting_ticks"],
        "planted_ticks": metrics["planted_ticks"],
        "uploading_ticks": metrics["uploading_ticks"],
        "completed_ticks": metrics["completed_ticks"],
        "cancel_reasons": sorted(metrics["cancel_reasons"]),
    }


def tick_impl():
    state["ticks"] += 1
    if state["finished"]:
        return
    if not level.is_in_play_in_editor():
        if state["ticks"] >= MATCH_STARTUP_TICKS:
            fail("PIE did not start")
        return

    game_world = get_world()
    if game_world is None:
        return
    if not state.get("pie_selection_logged"):
        instance = unreal.GameplayStatics.get_game_instance(game_world)
        if isinstance(instance, unreal.BLAGameInstance):
            state["pie_selection_logged"] = True
            instance.set_editor_property(
                "selected_mode",
                unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE if IS_DATA_CORE else unreal.BLA_MatchMode.TEAM_ELIMINATION)
            instance.apply_team_size(TEAM_SIZE)
            instance.apply_difficulty_level(unreal.BLA_DifficultyLevel.NORMAL)
            unreal.log(
                f"BLA_TASK11_SOAK_PIE_SELECTION mode={instance.get_editor_property('selected_mode')} "
                f"size={instance.get_editor_property('selected_team_size')} class={instance.get_class().get_name()}")
    managers = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAUIManager)
    if not managers or managers[0].get_round_manager() is None:
        return
    rounds = managers[0].get_round_manager()
    rounds.start_combat_phase()

    if state["match"] is None:
        state["match"] = start_match_metrics()
        state["match_tick"] = 0
    state["match_tick"] += 1
    collect(game_world, state["match"], state["match_tick"])
    if state["match_tick"] < MATCH_TICKS:
        return

    result = finish_match(game_world, state["match"])
    result["match"] = state["match_index"] + 1
    state["results"].append(result)
    unreal.log(
        f"BLA_TASK11_SOAK_MATCH mode={'data_core' if IS_DATA_CORE else 'elimination'} size={TEAM_SIZE} "
        f"match={result['match']} first_contact={result['first_contact']} moved={result['moved']} "
        f"stuck={result['stuck_ticks']} score={result['score']} round={result['round']} "
        f"routes={','.join(result['routes'])} targets={','.join(result['directive_targets'])} "
        f"recoveries={','.join(result['recovery_points'])} recovery_count={result['recovery_count']} "
        f"latest_zone={result['latest_zone']} latest_point={result['latest_tactical_point']} "
        f"no_displacement={result['no_displacement_ticks']} objective={','.join(result['objective_states'])} "
        f"reset={result['reset_count']} prep_ticks={result['preparation_ticks']} "
        f"carried_ticks={result['carried_ticks']} planting_ticks={result['planting_ticks']} "
        f"planted_ticks={result['planted_ticks']} uploading_ticks={result['uploading_ticks']} "
        f"completed_ticks={result['completed_ticks']} cancel_reasons={','.join(result['cancel_reasons']) or 'none'}")

    state["match"] = None
    state["match_index"] += 1
    if state["match_index"] < MATCHES:
        managers[0].restart_match()
        return

    contacts = [item["first_contact"] for item in state["results"] if item["first_contact"] is not None]
    contacts_text = ",".join(str(value) for value in contacts) if contacts else "none"
    routes = sorted({route for item in state["results"] for route in item["routes"]})
    objectives = sorted({value for item in state["results"] for value in item["objective_states"]})
    targets = sorted({target for item in state["results"] for target in item["directive_targets"]})
    recoveries = sorted({point for item in state["results"] for point in item["recovery_points"]})
    stuck_ticks = sum(item["stuck_ticks"] for item in state["results"])
    if TEAM_SIZE == 3 and "LeftRoute" not in routes:
        fail("missing LeftRoute")
        return
    if TEAM_SIZE == 3 and IS_DATA_CORE and stuck_ticks >= 6756:
        fail(f"stuck_ticks={stuck_ticks} not below baseline 6756")
        return
    if TEAM_SIZE == 3 and not IS_DATA_CORE and stuck_ticks >= 2000:
        fail(f"stuck_ticks={stuck_ticks} exceeds elimination cap 2000")
        return
    if TEAM_SIZE == 3 and stuck_ticks > 0 and not recoveries:
        fail(f"stuck_ticks={stuck_ticks} without recovery points")
        return
    unreal.log(
        f"BLA_TASK11_SOAK_OK mode={'data_core' if IS_DATA_CORE else 'elimination'} size={TEAM_SIZE} "
        f"matches={len(state['results'])} first_contact_ticks={contacts_text} "
        f"min_moved={min(item['moved'] for item in state['results'])} "
        f"stuck_ticks={stuck_ticks} "
        f"routes={','.join(routes)} targets={','.join(targets)} recoveries={','.join(recoveries)} "
        f"recovery_count={sum(item['recovery_count'] for item in state['results'])} "
        f"no_displacement={sum(item['no_displacement_ticks'] for item in state['results'])} "
        f"objective_states={','.join(objectives)} "
        f"reset={state['results'][-1]['reset_count']} prep_ticks={state['results'][-1]['preparation_ticks']} "
        f"carried_ticks={state['results'][-1]['carried_ticks']} planting_ticks={state['results'][-1]['planting_ticks']} "
        f"planted_ticks={state['results'][-1]['planted_ticks']} uploading_ticks={state['results'][-1]['uploading_ticks']} "
        f"completed_ticks={state['results'][-1]['completed_ticks']} "
        f"cancel_reasons={','.join(sorted({reason for item in state['results'] for reason in item['cancel_reasons']})) or 'none'}")
    state["finished"] = True
    level.editor_request_end_play()
    unreal.unregister_slate_post_tick_callback(handle)
    unreal.SystemLibrary.quit_editor()


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        fail(f"driver_error {error}")


default_instance = unreal.get_default_object(unreal.BLAGameInstance)
default_instance.set_editor_property("soak_requested", True)
default_instance.set_editor_property(
    "selected_mode",
    unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE if IS_DATA_CORE else unreal.BLA_MatchMode.TEAM_ELIMINATION)
default_instance.set_editor_property("selected_team_size", TEAM_SIZE)
if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
editor_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
editor_instance = unreal.GameplayStatics.get_game_instance(editor_world) if editor_world else None
if isinstance(editor_instance, unreal.BLAGameInstance):
    # PIE reuses the editor's game instance, so the soak flag has to be set there too; the
    # in-level flow tests read it and stand down instead of ending the match mid-observation.
    editor_instance.set_editor_property("soak_requested", True)
    editor_instance.set_editor_property(
        "selected_mode",
        unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE if IS_DATA_CORE else unreal.BLA_MatchMode.TEAM_ELIMINATION)
    editor_instance.apply_team_size(TEAM_SIZE)
    editor_instance.apply_difficulty_level(unreal.BLA_DifficultyLevel.NORMAL)
    unreal.log(
        f"BLA_TASK11_SOAK_EDITOR_SELECTION mode={editor_instance.get_editor_property('selected_mode')} "
        f"size={editor_instance.get_editor_property('selected_team_size')} class={editor_instance.get_class().get_name()}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log(f"BLA_TASK11_SOAK_STARTED mode={'data_core' if IS_DATA_CORE else 'elimination'} "
           f"size={TEAM_SIZE} matches={MATCHES}")
