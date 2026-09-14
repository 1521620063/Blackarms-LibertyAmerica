import unreal


CORE_PATH = "/Game/BLA/Blueprints/Core"
TEAM_PATH = "/Game/BLA/Blueprints/Teams"
ROUND_PATH = "/Game/BLA/Blueprints/Rounds"
MAP_PATH = "/Game/BLA/Blueprints/Maps"
TEST_PATH = "/Game/BLA/Tests"

BLUEPRINTS = {
    f"{CORE_PATH}/BP_BLAGameInstance": "/Script/BLA.BLAGameInstance",
    f"{CORE_PATH}/BP_BLAGameMode": "/Script/BLA.BLAGameMode",
    f"{CORE_PATH}/BP_BLAGameState": "/Script/BLA.BLAGameState",
    f"{TEAM_PATH}/BP_BLATeamManager": "/Script/BLA.BLATeamManager",
    f"{ROUND_PATH}/BP_BLARoundManager": "/Script/BLA.BLARoundManager",
    f"{ROUND_PATH}/BP_BLARoundResultData": "/Script/BLA.BLARoundResultData",
    f"{MAP_PATH}/BP_BLASpawnPoint": "/Script/BLA.BLASpawnPoint",
    f"{TEST_PATH}/BP_BLARoundTestActor": "/Script/BLA.BLARoundTestActor",
}


def fail(message):
    raise RuntimeError("TASK5_CONTRACT_FAILURE " + message)


def main():
    required = [
        "BLAGameInstance",
        "BLAGameMode",
        "BLAGameState",
        "BLATeamManager",
        "BLARoundManager",
        "BLARoundResultData",
        "BLASpawnPoint",
        "BLARoundTestActor",
    ]
    for name in required:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    game_state = unreal.BLAGameState()
    for field in [
        "match_mode",
        "round_phase",
        "current_round",
        "attackers_score",
        "defenders_score",
        "attackers_team_size",
        "defenders_team_size",
        "round_time_remaining",
        "current_objective_state",
    ]:
        try:
            game_state.get_editor_property(field)
        except Exception as error:
            fail(f"game state missing {field}: {error}")

    for path, expected_parent in BLUEPRINTS.items():
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != expected_parent:
            fail(f"{path} parent: expected {expected_parent}, got {parent.get_path_name()}")

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not level_editor.load_level("/Game/BLA/Maps/Graybox/L_TestBootstrap"):
        fail("could not load the bootstrap map")
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    default_mode = world.get_world_settings().get_editor_property("default_game_mode") if world else None
    if default_mode is None or "BP_BLAGameMode" not in default_mode.get_path_name():
        fail(f"bootstrap map default game mode: got {default_mode}")

    unreal.log("BLA_TASK5_CONTRACTS_OK native=8 blueprints=8 default_map_game_mode=1")


main()
