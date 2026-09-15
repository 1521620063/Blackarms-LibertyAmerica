import unreal


UI_PATH = "/Game/BLA/Blueprints/UI"
MAPS_PATH = "/Game/BLA/Blueprints/Maps"
TEST_PATH = "/Game/BLA/Tests"
MENU_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
FINAL_LEVEL = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"

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


def place_actor(level_path, actor_class, label, location, properties=None):
    if not levels.load_level(level_path):
        raise RuntimeError(f"Failed to load {level_path}")
    for actor in actors.get_all_level_actors():
        if actor.get_actor_label() == label:
            actors.destroy_actor(actor)
    spawned = actors.spawn_actor_from_class(actor_class, unreal.Vector(*location), unreal.Rotator())
    if spawned is None:
        raise RuntimeError(f"Failed to place {label}")
    spawned.set_actor_label(label)
    if properties:
        spawned.set_editor_properties(properties)
    if not levels.save_current_level():
        raise RuntimeError(f"Failed to save {level_path}")
    return spawned


def main():
    harness = blueprint(f"{MAPS_PATH}/BP_BLATestHarness", unreal.BLATestHarness)
    flows = blueprint(f"{TEST_PATH}/FT_BLA_AllMVPFlows", unreal.BLAAllMVPFlowsTest)
    place_actor(MENU_LEVEL, harness.generated_class(), "BLA Test Harness", (0.0, 0.0, 700.0),
                {"target_map_path": "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"})
    place_actor(FINAL_LEVEL, flows.generated_class(), "BLA All MVP Flows Test", (0.0, 0.0, 800.0))
    unreal.log("BLA_TASK12_ASSETS_BUILT debug_subsystem=cpp harness=1 flows_test=1 harness_placed=1 flows_placed=1")


main()
