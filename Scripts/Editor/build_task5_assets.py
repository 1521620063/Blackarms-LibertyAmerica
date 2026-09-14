import unreal


BOOTSTRAP_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
TEST_PATH = "/Game/BLA/Tests"

BLUEPRINTS = {
    "/Game/BLA/Blueprints/Core/BP_BLAGameInstance": unreal.BLAGameInstance,
    "/Game/BLA/Blueprints/Core/BP_BLAGameMode": unreal.BLAGameMode,
    "/Game/BLA/Blueprints/Core/BP_BLAGameState": unreal.BLAGameState,
    "/Game/BLA/Blueprints/Teams/BP_BLATeamManager": unreal.BLATeamManager,
    "/Game/BLA/Blueprints/Rounds/BP_BLARoundManager": unreal.BLARoundManager,
    "/Game/BLA/Blueprints/Rounds/BP_BLARoundResultData": unreal.BLARoundResultData,
    "/Game/BLA/Blueprints/Maps/BP_BLASpawnPoint": unreal.BLASpawnPoint,
    f"{TEST_PATH}/BP_BLARoundTestActor": unreal.BLARoundTestActor,
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
    blueprint = unreal.load_asset(f"{TEST_PATH}/BP_BLARoundTestActor")
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
        actor.set_actor_label("BLA Round Test Actor")
    elif len(actors) > 1:
        for duplicate in actors[1:]:
            actor_subsystem.destroy_actor(duplicate)

    # The bootstrap map is the project's default map; it must run BLA rules instead of the
    # FirstPerson template game mode it was copied from.
    game_mode = unreal.load_asset("/Game/BLA/Blueprints/Core/BP_BLAGameMode")
    if game_mode is None:
        raise RuntimeError("Failed to load BP_BLAGameMode for the bootstrap map")
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    world.get_world_settings().set_editor_property("default_game_mode", game_mode.generated_class())

    if not level_editor.save_current_level():
        raise RuntimeError(f"Failed to save {BOOTSTRAP_LEVEL}")


def main():
    build_blueprints()
    place_validator()
    unreal.log("BLA_TASK5_ASSETS_BUILT blueprints=8 validators=1")


main()
