import unreal


CORE_PATH = "/Game/FPS/Blueprints/Core"
TEAM_PATH = "/Game/FPS/Blueprints/Teams"
ROUND_PATH = "/Game/FPS/Blueprints/Rounds"
MAP_PATH = "/Game/FPS/Blueprints/Maps"
TEST_PATH = "/Game/FPS/Tests"

BLUEPRINTS = {
    f"{CORE_PATH}/BP_FPSGameInstance": "/Script/FPS.FPSGameInstance",
    f"{CORE_PATH}/BP_FPSGameMode": "/Script/FPS.FPSGameMode",
    f"{CORE_PATH}/BP_FPSGameState": "/Script/FPS.FPSGameState",
    f"{TEAM_PATH}/BP_FPSTeamManager": "/Script/FPS.FPSTeamManager",
    f"{ROUND_PATH}/BP_FPSRoundManager": "/Script/FPS.FPSRoundManager",
    f"{ROUND_PATH}/BP_FPSRoundResultData": "/Script/FPS.FPSRoundResultData",
    f"{MAP_PATH}/BP_FPSSpawnPoint": "/Script/FPS.FPSSpawnPoint",
    f"{TEST_PATH}/BP_FPSRoundTestActor": "/Script/FPS.FPSRoundTestActor",
}


def fail(message):
    raise RuntimeError("TASK5_CONTRACT_FAILURE " + message)


def main():
    required = [
        "FPSGameInstance",
        "FPSGameMode",
        "FPSGameState",
        "FPSTeamManager",
        "FPSRoundManager",
        "FPSRoundResultData",
        "FPSSpawnPoint",
        "FPSRoundTestActor",
    ]
    for name in required:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    game_state = unreal.FPSGameState()
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

    unreal.log("FPS_TASK5_CONTRACTS_OK native=8 blueprints=8")


main()
