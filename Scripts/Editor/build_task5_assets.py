import unreal


BOOTSTRAP_LEVEL = "/Game/FPS/Maps/Graybox/L_TestBootstrap"
TEST_PATH = "/Game/FPS/Tests"

BLUEPRINTS = {
    "/Game/FPS/Blueprints/Core/BP_FPSGameInstance": unreal.FPSGameInstance,
    "/Game/FPS/Blueprints/Core/BP_FPSGameMode": unreal.FPSGameMode,
    "/Game/FPS/Blueprints/Core/BP_FPSGameState": unreal.FPSGameState,
    "/Game/FPS/Blueprints/Teams/BP_FPSTeamManager": unreal.FPSTeamManager,
    "/Game/FPS/Blueprints/Rounds/BP_FPSRoundManager": unreal.FPSRoundManager,
    "/Game/FPS/Blueprints/Rounds/BP_FPSRoundResultData": unreal.FPSRoundResultData,
    "/Game/FPS/Blueprints/Maps/BP_FPSSpawnPoint": unreal.FPSSpawnPoint,
    f"{TEST_PATH}/BP_FPSRoundTestActor": unreal.FPSRoundTestActor,
}

asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)


def save(asset):
    if not asset_subsystem.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")


def build_blueprints():
    for path, parent in BLUEPRINTS.items():
        if asset_subsystem.does_asset_exist(path):
            blueprint = unreal.load_asset(path)
        else:
            blueprint = unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(
                path, parent
            )
        if blueprint is None:
            raise RuntimeError(f"Failed to create {path}")
        unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
        save(blueprint)


def place_validator():
    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not level_editor.load_level(BOOTSTRAP_LEVEL):
        raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    blueprint = unreal.load_asset(f"{TEST_PATH}/BP_FPSRoundTestActor")
    validator_class = blueprint.generated_class()
    actors = [
        actor for actor in actor_subsystem.get_all_level_actors()
        if actor.get_class() == validator_class
    ]
    if not actors:
        actor = actor_subsystem.spawn_actor_from_class(
            validator_class, unreal.Vector(0.0, 0.0, 550.0), unreal.Rotator()
        )
        if actor is None:
            raise RuntimeError("Failed to place round test actor")
        actor.set_actor_label("FPS Round Test Actor")
    elif len(actors) > 1:
        for duplicate in actors[1:]:
            actor_subsystem.destroy_actor(duplicate)
    if not level_editor.save_current_level():
        raise RuntimeError(f"Failed to save {BOOTSTRAP_LEVEL}")


def main():
    build_blueprints()
    place_validator()
    unreal.log("FPS_TASK5_ASSETS_BUILT blueprints=8 validators=1")


main()
