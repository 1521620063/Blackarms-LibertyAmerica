import os

import unreal


MAP = "/Game/FPS/Maps/Graybox/L_FPS_1v1_Elimination"
MAX_STARTUP_TICKS = 600
VALIDATION_TICKS = 300
TEAM_SIZE = max(1, min(3, int(os.environ.get("FPS_TASK8_TEAM_SIZE", "3"))))

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie": 0, "ending": False, "configured": False}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"FPS_TASK8_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
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
    if not state["configured"]:
        game_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
        game_instance = unreal.GameplayStatics.get_game_instance(game_world) if game_world else None
        if not isinstance(game_instance, unreal.FPSGameInstance):
            finish(False, f"PIE game instance unavailable: {game_instance}")
            return
        game_instance.set_editor_property("selected_team_size", TEAM_SIZE)
        state["configured"] = True
        unreal.log(f"FPS_TASK8_PIE_GAME_INSTANCE_SET team_size={TEAM_SIZE}")
    state["pie"] += 1
    if state["pie"] >= VALIDATION_TICKS:
        game_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
        round_managers = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.FPSRoundManager)
        expected_total = TEAM_SIZE * 2
        matching = []
        for rounds in round_managers:
            if rounds.get_editor_property("team_order_manager") is None:
                continue
            manager = rounds.get_editor_property("team_manager")
            if manager is None:
                continue
            attackers = manager.get_team_members(unreal.FPS_Team.ATTACKERS)
            defenders = manager.get_team_members(unreal.FPS_Team.DEFENDERS)
            members = attackers + defenders
            if len(attackers) == TEAM_SIZE and len(defenders) == TEAM_SIZE and len(members) == expected_total:
                matching.append(members)
        if len(matching) != 1:
            finish(False, f"team population mismatch team_size={TEAM_SIZE} matches={len(matching)}")
            return
        identities = {member.get_path_name() for member in matching[0]}
        if len(identities) != expected_total:
            finish(False, f"duplicate registration team_size={TEAM_SIZE}")
            return
        finish(True, f"ticks={state['pie']} team_size={TEAM_SIZE} registration={expected_total} duplicates=0")


default_instance = unreal.get_default_object(unreal.FPSGameInstance)
default_instance.set_editor_property("selected_team_size", TEAM_SIZE)
if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
editor_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
editor_instance = unreal.GameplayStatics.get_game_instance(editor_world) if editor_world else None
if isinstance(editor_instance, unreal.FPSGameInstance):
    editor_instance.set_editor_property("selected_team_size", TEAM_SIZE)
    unreal.log(f"FPS_TASK8_EDITOR_GAME_INSTANCE_SET team_size={TEAM_SIZE}")
else:
    unreal.log_warning(f"FPS_TASK8_EDITOR_GAME_INSTANCE_UNAVAILABLE instance={editor_instance}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log(f"FPS_TASK8_PIE_DRIVER_STARTED team_size={TEAM_SIZE}")
