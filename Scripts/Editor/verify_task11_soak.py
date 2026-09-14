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
    }


def collect(game_world, metrics, tick):
    bots = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLABotCharacter)
    if not metrics["start_positions"] and bots:
        metrics["start_positions"] = {bot.get_path_name(): bot.get_actor_location() for bot in bots}
    zones = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAMapZone)
    for bot in bots:
        location = bot.get_actor_location()
        for zone in zones:
            if zone.contains_location(location):
                metrics["route_hits"].add(str(zone.get_editor_property("zone_name")))
        controller = bot.get_controller()
        if isinstance(controller, unreal.BLAAIController):
            if controller.get_editor_property("is_stuck"):
                metrics["stuck_ticks"] += 1
            perception = controller.get_editor_property("bot_perception")
            target = perception.get_editor_property("target_actor") if perception else None
            if target is not None and metrics["first_contact"] is None:
                metrics["first_contact"] = tick
    for manager in unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAObjectiveManager):
        metrics["objective_states"].add(str(manager.get_editor_property("objective_state")))


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
        f"routes={','.join(result['routes'])} objective={','.join(result['objective_states'])}")

    state["match"] = None
    state["match_index"] += 1
    if state["match_index"] < MATCHES:
        managers[0].restart_match()
        return

    contacts = [item["first_contact"] for item in state["results"] if item["first_contact"] is not None]
    contacts_text = ",".join(str(value) for value in contacts) if contacts else "none"
    routes = sorted({route for item in state["results"] for route in item["routes"]})
    objectives = sorted({value for item in state["results"] for value in item["objective_states"]})
    unreal.log(
        f"BLA_TASK11_SOAK_OK mode={'data_core' if IS_DATA_CORE else 'elimination'} size={TEAM_SIZE} "
        f"matches={len(state['results'])} first_contact_ticks={contacts_text} "
        f"min_moved={min(item['moved'] for item in state['results'])} "
        f"stuck_ticks={sum(item['stuck_ticks'] for item in state['results'])} "
        f"routes={','.join(routes)} objective_states={','.join(objectives)}")
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
default_instance.set_editor_property(
    "selected_mode",
    unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE if IS_DATA_CORE else unreal.BLA_MatchMode.TEAM_ELIMINATION)
default_instance.set_editor_property("selected_team_size", TEAM_SIZE)
if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
editor_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
editor_instance = unreal.GameplayStatics.get_game_instance(editor_world) if editor_world else None
if isinstance(editor_instance, unreal.BLAGameInstance):
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
