import unreal

AI_BP = "/Game/BLA/Blueprints/AI"
AI_ROOT = "/Game/BLA/AI"
TEST_PATH = "/Game/BLA/Tests"
BOOTSTRAP = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
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
        "BP_BLAAIController": unreal.BLAAIController, "BP_BLABotPerception": unreal.BLABotPerception,
        "BP_BLATacticalManager": unreal.BLATacticalManager, "BP_BLATacticalPoint": unreal.BLATacticalPoint,
    }.items(): bp(f"{AI_BP}/{name}", parent)
    task_assets = [bp(f"{AI_ROOT}/Tasks/{name}", unreal.BTTask_BlueprintBase) for name in ["BTT_BLAAimAndFire", "BTT_BLAFindCover", "BTT_BLAMoveToTacticalPoint", "BTT_BLASearchLastKnownPosition"]]
    service_assets = [bp(f"{AI_ROOT}/Services/{name}", unreal.BTService_BlueprintBase) for name in ["BTS_BLAUpdateTarget", "BTS_BLACheckStuck"]]
    bp(f"{AI_ROOT}/Decorators/BPD_BLAHasLiveTarget", unreal.BTDecorator_BlueprintBase)
    fixture = bp(f"{TEST_PATH}/BP_BLAAITestFixture", unreal.BLAAITestFixture)

    bb_path = f"{AI_ROOT}/Blackboards/BB_BLABot"
    bb = unreal.load_asset(bb_path) if assets.does_asset_exist(bb_path) else asset_tools.create_asset("BB_BLABot", f"{AI_ROOT}/Blackboards", unreal.BlackboardData, unreal.BlackboardDataFactory())
    if not unreal.BLABlueprintAssetBuilder.configure_bla_bot_blackboard(bb): raise RuntimeError("Failed to configure BB_BLABot")
    save(bb)
    bt_path = f"{AI_ROOT}/BehaviorTrees/BT_BLABotElimination"
    bt = unreal.load_asset(bt_path) if assets.does_asset_exist(bt_path) else asset_tools.create_asset("BT_BLABotElimination", f"{AI_ROOT}/BehaviorTrees", unreal.BehaviorTree, unreal.BehaviorTreeFactory())
    if not unreal.BLABlueprintAssetBuilder.configure_bla_bot_behavior_tree(bt, bb, [a.generated_class() for a in task_assets], [a.generated_class() for a in service_assets]): raise RuntimeError("Failed to configure BT_BLABotElimination")
    save(bt)

    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem); levels.load_level(BOOTSTRAP)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem); cls = fixture.generated_class()
    if not any(a.get_class() == cls for a in actors.get_all_level_actors()): actors.spawn_actor_from_class(cls, unreal.Vector(0,0,650), unreal.Rotator())
    for nav in [a for a in actors.get_all_level_actors() if isinstance(a, unreal.NavMeshBoundsVolume) and a.get_actor_label() == "BLA Bootstrap Navigation Bounds"]:
        actors.destroy_actor(nav)
    levels.save_current_level()
    unreal.log("BLA_TASK6_ASSETS_BUILT blueprints=12 blackboard_keys=9 behavior_trees=1 validators=1")

build()
