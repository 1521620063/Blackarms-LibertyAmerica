import unreal


UI_PATH = "/Game/BLA/Blueprints/UI"
TEST_PATH = "/Game/BLA/Tests"
MENU_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
MATCH_LEVEL = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"

WIDGETS = [
    "WBP_BLAMainMenu",
    "WBP_BLAModeSelect",
    "WBP_BLASettings",
    "WBP_BLAMatchHUD",
    "WBP_BLATeamStatus",
    "WBP_BLAWeaponStatus",
    "WBP_BLAObjectiveStatus",
    "WBP_BLARoundResult",
    "WBP_BLAMatchResult",
    "WBP_BLALANWaiting",
    "WBP_BLAInteractionPrompt",
    "WBP_BLACommandSelector",
]

MANAGER_WIDGETS = [
    "main_menu_class",
    "mode_select_class",
    "settings_class",
    "match_hud_class",
    "team_status_class",
    "weapon_status_class",
    "objective_status_class",
    "round_result_class",
    "match_result_class",
    "lan_waiting_class",
    "interaction_prompt_class",
    "command_selector_class",
]

HUD_FIELDS = [
    "health",
    "armor",
    "alive",
    "death_state",
    "magazine_ammo",
    "reserve_ammo",
    "weapon_type",
    "team",
    "attackers_score",
    "defenders_score",
    "current_round",
    "round_time_remaining",
    "round_phase",
    "match_mode",
    "objective_state",
    "objective_remaining",
    "living_teammates",
    "living_enemies",
    "current_order",
    "kills",
    "deaths",
    "damage_dealt",
    "objective_contribution",
    "crosshair_enabled",
]

SETTINGS_FIELDS = [
    "mouse_sensitivity",
    "field_of_view",
    "resolution_width",
    "resolution_height",
    "fullscreen",
    "master_volume",
    "music_volume",
    "effects_volume",
    "subtitles",
    "crosshair",
    "color_assistance",
]


def fail(message):
    raise RuntimeError("TASK10_CONTRACT_FAILURE " + message)


def main():
    for name in [
        "BLAUIManager",
        "BLAUIFlowTest",
        "BLASettingsSaveGame",
        "BLAGameInstance",
        "BLAGameModeElimination",
        "BLA_UIScreen",
        "BLA_UIFlowKind",
        "BLAMatchHUDState",
    ]:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    for name in WIDGETS:
        path = f"{UI_PATH}/{name}"
        if unreal.load_asset(path) is None:
            fail(f"missing widget Blueprint {path}")

    manager = unreal.load_asset(f"{UI_PATH}/BP_BLAUIManager")
    if manager is None:
        fail("missing BP_BLAUIManager")
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(manager)
    if parent.get_path_name() != "/Script/BLA.BLAUIManager":
        fail(f"BP_BLAUIManager parent: got {parent.get_path_name()}")
    cdo = unreal.get_default_object(manager.generated_class())
    for field in MANAGER_WIDGETS:
        if cdo.get_editor_property(field) is None:
            fail(f"BP_BLAUIManager did not wire {field}")
    if cdo.get_editor_property("spectator_class") is None:
        fail("BP_BLAUIManager did not wire spectator_class")
    for function in [
        "restart_match",
        "evaluate_match_screens",
        "host_lan_match",
        "join_lan_match",
        "start_lan_match",
        "leave_lan",
    ]:
        if not callable(getattr(cdo, function, None)):
            fail(f"BP_BLAUIManager is missing {function}")
    try:
        cdo.get_editor_property("last_error_text")
    except Exception as error:
        fail(f"UI manager missing last_error_text: {error}")

    hud = unreal.BLAMatchHUDState()
    for field in HUD_FIELDS:
        try:
            hud.get_editor_property(field)
        except Exception as error:
            fail(f"HUD state missing {field}: {error}")

    settings = unreal.BLASettingsSaveGame()
    for field in SETTINGS_FIELDS:
        try:
            settings.get_editor_property(field)
        except Exception as error:
            fail(f"save object missing {field}: {error}")

    game_instance = unreal.get_default_object(unreal.BLAGameInstance)
    for field in [
        "selected_mode",
        "selected_rules",
        "selected_difficulty",
        "selected_team_size",
        "selected_difficulty_level",
        "menu_map_path",
        "match_map_path",
        "last_travel_request",
        "travel_immediately",
        "travel_in_progress",
        "last_flow_error",
    ]:
        try:
            game_instance.get_editor_property(field)
        except Exception as error:
            fail(f"game instance missing {field}: {error}")
    for function in [
        "apply_mode_selection",
        "apply_team_size",
        "apply_difficulty_level",
        "save_settings",
        "load_settings",
        "reset_settings",
        "travel_to",
        "request_start_match",
        "request_host_lan_match",
        "request_join_lan_match",
        "request_leave_lan",
        "request_return_to_menu",
    ]:
        if not callable(getattr(game_instance, function, None)):
            fail(f"game instance missing {function}")

    flow_test = unreal.load_asset(f"{TEST_PATH}/FT_BLA_UIFlow")
    if flow_test is None:
        fail("missing FT_BLA_UIFlow")
    flow_parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(flow_test)
    if flow_parent.get_path_name() != "/Script/BLA.BLAUIFlowTest":
        fail(f"FT_BLA_UIFlow parent: got {flow_parent.get_path_name()}")

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    for level_path, expected_flow, label in [
        (MENU_LEVEL, unreal.BLA_UIFlowKind.MENU, "menu"),
        (MATCH_LEVEL, unreal.BLA_UIFlowKind.MATCH, "match"),
    ]:
        if not level_editor.load_level(level_path):
            fail(f"could not load {level_path}")
        matches = [
            actor for actor in actor_subsystem.get_all_level_actors()
            if actor.get_class() == flow_test.generated_class()
        ]
        if len(matches) != 1:
            fail(f"{label} map flow test count={len(matches)}")
        if matches[0].get_editor_property("flow") != expected_flow:
            fail(f"{label} map flow test kind mismatch")
        matches[0].get_editor_property("test_succeeded")
        matches[0].get_editor_property("test_failed")

    unreal.log("BLA_TASK10_CONTRACTS_OK widgets=12 managers=1 flow_tests=2 hud_fields=24 settings_fields=11 game_instance_api=12 flow_guards=1")


main()
