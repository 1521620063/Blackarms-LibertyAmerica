import unreal

AI_BP = "/Game/FPS/Blueprints/AI"
AI_ROOT = "/Game/FPS/AI"
TEST_PATH = "/Game/FPS/Tests"
BOOTSTRAP = "/Game/FPS/Maps/Graybox/L_TestBootstrap"
asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

def save(asset):
    if not assets.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")

def bp(path, parent):
    result = unreal.load_asset(path) if assets.does_asset_exist(path) else unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(path, parent)
    if result is None: raise RuntimeError(f"Failed to create {path}")
    unreal.BlueprintEditorLibrary.compile_blueprint(result); save(result)
    return result

def build():
    for name, parent in {
        "BP_FPSAIController": unreal.FPSAIController, "BP_FPSBotPerception": unreal.FPSBotPerception,
        "BP_FPSTacticalManager": unreal.FPSTacticalManager, "BP_FPSTacticalPoint": unreal.FPSTacticalPoint,
    }.items(): bp(f"{AI_BP}/{name}", parent)
    task_assets = [bp(f"{AI_ROOT}/Tasks/{name}", unreal.BTTask_BlueprintBase) for name in ["BTT_FPSAimAndFire", "BTT_FPSFindCover", "BTT_FPSMoveToTacticalPoint", "BTT_FPSSearchLastKnownPosition"]]
    service_assets = [bp(f"{AI_ROOT}/Services/{name}", unreal.BTService_BlueprintBase) for name in ["BTS_FPSUpdateTarget", "BTS_FPSCheckStuck"]]
    bp(f"{AI_ROOT}/Decorators/BPD_FPSHasLiveTarget", unreal.BTDecorator_BlueprintBase)
    fixture = bp(f"{TEST_PATH}/BP_FPSAITestFixture", unreal.FPSAITestFixture)

    bb_path = f"{AI_ROOT}/Blackboards/BB_FPSBot"
    bb = unreal.load_asset(bb_path) if assets.does_asset_exist(bb_path) else asset_tools.create_asset("BB_FPSBot", f"{AI_ROOT}/Blackboards", unreal.BlackboardData, unreal.BlackboardDataFactory())
    if not unreal.FPSBlueprintAssetBuilder.configure_fps_bot_blackboard(bb): raise RuntimeError("Failed to configure BB_FPSBot")
    save(bb)
    bt_path = f"{AI_ROOT}/BehaviorTrees/BT_FPSBotElimination"
    bt = unreal.load_asset(bt_path) if assets.does_asset_exist(bt_path) else asset_tools.create_asset("BT_FPSBotElimination", f"{AI_ROOT}/BehaviorTrees", unreal.BehaviorTree, unreal.BehaviorTreeFactory())
    if not unreal.FPSBlueprintAssetBuilder.configure_fps_bot_behavior_tree(bt, bb, [a.generated_class() for a in task_assets], [a.generated_class() for a in service_assets]): raise RuntimeError("Failed to configure BT_FPSBotElimination")
    save(bt)

    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem); levels.load_level(BOOTSTRAP)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem); cls = fixture.generated_class()
    if not any(a.get_class() == cls for a in actors.get_all_level_actors()): actors.spawn_actor_from_class(cls, unreal.Vector(0,0,650), unreal.Rotator())
    for nav in [a for a in actors.get_all_level_actors() if isinstance(a, unreal.NavMeshBoundsVolume) and a.get_actor_label() == "FPS Bootstrap Navigation Bounds"]:
        actors.destroy_actor(nav)
    levels.save_current_level()
    unreal.log("FPS_TASK6_ASSETS_BUILT blueprints=12 blackboard_keys=9 behavior_trees=1 validators=1")

build()
