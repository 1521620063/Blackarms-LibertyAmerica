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
    "WBP_BLAInteractionPrompt",
    "WBP_BLACommandSelector",
]

# Widget class property on BP_BLAUIManager -> widget asset
MANAGER_WIDGETS = {
    "main_menu_class": "WBP_BLAMainMenu",
    "mode_select_class": "WBP_BLAModeSelect",
    "settings_class": "WBP_BLASettings",
    "match_hud_class": "WBP_BLAMatchHUD",
    "team_status_class": "WBP_BLATeamStatus",
    "weapon_status_class": "WBP_BLAWeaponStatus",
    "objective_status_class": "WBP_BLAObjectiveStatus",
    "round_result_class": "WBP_BLARoundResult",
    "match_result_class": "WBP_BLAMatchResult",
    "interaction_prompt_class": "WBP_BLAInteractionPrompt",
    "command_selector_class": "WBP_BLACommandSelector",
}

assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def save(asset):
    if not assets.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")


def blueprint(path, parent):
    result = unreal.load_asset(path) if assets.does_asset_exist(path) else unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(path, parent)
    if result is None:
        raise RuntimeError(f"Failed to create {path}")
    unreal.BlueprintEditorLibrary.compile_blueprint(result)
    save(result)
    return result


def build_widgets():
    for name in WIDGETS:
        blueprint(f"{UI_PATH}/{name}", unreal.UserWidget)


def build_ui_manager():
    manager = blueprint(f"{UI_PATH}/BP_BLAUIManager", unreal.BLAUIManager)
    cdo = unreal.get_default_object(manager.generated_class())
    for field, widget_name in MANAGER_WIDGETS.items():
        widget_class = unreal.load_asset(f"{UI_PATH}/{widget_name}").generated_class()
        cdo.set_editor_property(field, widget_class)
    spectator = unreal.load_asset(f"{UI_PATH}/WBP_BLASpectator")
    if spectator is not None:
        cdo.set_editor_property("spectator_class", spectator.generated_class())
    unreal.BlueprintEditorLibrary.compile_blueprint(manager)
    save(manager)


def place_flow_test(test_blueprint, level_path, label, flow):
    if not levels.load_level(level_path):
        raise RuntimeError(f"Failed to load {level_path}")
    test_class = test_blueprint.generated_class()
    for actor in actors.get_all_level_actors():
        if actor.get_class() == test_class:
            actors.destroy_actor(actor)
    test_actor = actors.spawn_actor_from_class(test_class, unreal.Vector(0.0, 0.0, 650.0), unreal.Rotator())
    if test_actor is None:
        raise RuntimeError(f"Failed to place {label}")
    test_actor.set_actor_label(label)
    test_actor.set_editor_property("flow", flow)
    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {level_path}")


def build_lan_flow_test():
    lan_test = blueprint(f"{TEST_PATH}/BP_BLALanFlowTest", unreal.BLALanFlowTest)
    if not levels.load_level(MENU_LEVEL):
        raise RuntimeError(f"Failed to load {MENU_LEVEL}")
    lan_class = lan_test.generated_class()
    matches = [actor for actor in actors.get_all_level_actors() if actor.get_class() == lan_class]
    if not matches:
        actor = actors.spawn_actor_from_class(lan_class, unreal.Vector(0.0, 0.0, 725.0), unreal.Rotator())
        if actor is None:
            raise RuntimeError("Failed to place BP_BLALanFlowTest")
        actor.set_actor_label("BLA LAN Flow Test")
    for duplicate in matches[1:]:
        actors.destroy_actor(duplicate)
    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {MENU_LEVEL}")


def main():
    _, switches, _ = unreal.SystemLibrary.parse_command_line(unreal.SystemLibrary.get_command_line())
    lan_only = "BLALanAssetsOnly" in switches
    if not lan_only:
        build_widgets()
        build_ui_manager()
        test = blueprint(f"{TEST_PATH}/FT_BLA_UIFlow", unreal.BLAUIFlowTest)
        place_flow_test(test, MENU_LEVEL, "BLA UI Flow Test (Menu)", unreal.BLA_UIFlowKind.MENU)
        place_flow_test(test, MATCH_LEVEL, "BLA UI Flow Test (Match)", unreal.BLA_UIFlowKind.MATCH)
    build_lan_flow_test()
    if lan_only:
        unreal.log("BLA_LAN_TASK1_ASSETS_BUILT flow_tests=1")
        return
    unreal.log("BLA_TASK10_ASSETS_BUILT widgets=11 managers=1 flow_tests=2 settings_wired=11 flow_guards=1")


main()
