import unreal

MAP = "/Game/FPS/Maps/Graybox/L_FPS_1v1_Elimination"
MODE = "/Game/FPS/Blueprints/Core/BP_FPSGameMode_Elimination"
TEST = "/Game/FPS/Tests/FT_FPS_1v1_Elimination"

def fail(message):
    raise RuntimeError("TASK7_CONTRACT_FAILURE " + message)

def main():
    for name in ["FPSGameModeElimination", "FPS1v1EliminationTest"]:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")
    for path in [MAP, MODE, TEST]:
        if not unreal.get_editor_subsystem(unreal.EditorAssetSubsystem).does_asset_exist(path):
            fail(f"missing asset {path}")
    mode = unreal.load_asset(MODE)
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(mode)
    if parent.get_path_name() != "/Script/FPS.FPSGameModeElimination":
        fail(f"unexpected game mode parent {parent.get_path_name()}")
    test = unreal.load_asset(TEST)
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(test)
    if parent.get_path_name() != "/Script/FPS.FPS1v1EliminationTest":
        fail(f"unexpected test parent {parent.get_path_name()}")
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not levels.load_level(MAP):
        fail(f"could not load map {MAP}")
    level_actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    labels = {actor.get_actor_label() for actor in level_actors}
    required_labels = {
        "Arena Floor", "Attacker Spawn Shield", "Defender Spawn Shield",
        "Cover Left", "Cover Center", "Cover Right",
        "Attacker Protected Spawn", "Defender Protected Spawn",
        "1v1 Arena Navigation Bounds", "FPS 1v1 Elimination Functional Test",
    }
    missing = required_labels - labels
    if missing:
        fail(f"map missing required actors {sorted(missing)}")
    if not any(isinstance(actor, unreal.RecastNavMesh) for actor in level_actors):
        fail("map has no built RecastNavMesh")
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    default_mode = world.get_world_settings().get_editor_property("default_game_mode")
    if default_mode != mode.generated_class():
        fail(f"map game mode override mismatch {default_mode}")
    unreal.log("FPS_TASK7_CONTRACTS_OK map=1 room=1 protected_spawns=2 cover=3 navmesh=1 game_modes=1 functional_tests=1")

main()
