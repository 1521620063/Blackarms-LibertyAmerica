import unreal


MAP = "/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination"
ORDER_MANAGER = "/Game/BLA/Blueprints/Teams/BP_BLATeamOrderManager"
ROLE_ASSIGNMENT = "/Game/BLA/Blueprints/Teams/BP_BLARoleAssignment"
FOLLOW_TASK = "/Game/BLA/AI/Tasks/BTT_BLAFollowPlayer"
GUARD_TASK = "/Game/BLA/AI/Tasks/BTT_BLAGuardPoint"
ATTACK_TASK = "/Game/BLA/AI/Tasks/BTT_BLAAttackRoute"
SPECTATOR_WIDGET = "/Game/BLA/Blueprints/UI/WBP_BLASpectator"
TEST = "/Game/BLA/Tests/FT_BLA_3v3_Elimination"


def fail(message):
    raise RuntimeError("TASK8_CONTRACT_FAILURE " + message)


def require_native_type(name):
    native_type = getattr(unreal, name, None)
    if native_type is None:
        fail(f"missing native type unreal.{name}")
    return native_type


def require_blueprint(path, parent_path):
    assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
    if not assets.does_asset_exist(path):
        fail(f"missing asset {path}")
    blueprint = unreal.load_asset(path)
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
    if parent.get_path_name() != parent_path:
        fail(f"unexpected parent for {path}: {parent.get_path_name()}")
    return blueprint


def main():
    require_native_type("BLATeamOrderManager")
    require_native_type("BLARoleAssignment")
    require_native_type("BLA3v3EliminationTest")

    order_values = {value.name for value in unreal.BLA_TeamOrder}
    expected_orders = {"FOLLOW_PLAYER", "HOLD_HERE", "ATTACK_TARGET", "RETREAT"}
    if order_values != expected_orders:
        fail(f"unexpected EBLA_TeamOrder values {sorted(order_values)}")

    require_blueprint(ORDER_MANAGER, "/Script/BLA.BLATeamOrderManager")
    require_blueprint(ROLE_ASSIGNMENT, "/Script/BLA.BLARoleAssignment")
    require_blueprint(FOLLOW_TASK, "/Script/AIModule.BTTask_BlueprintBase")
    require_blueprint(GUARD_TASK, "/Script/AIModule.BTTask_BlueprintBase")
    require_blueprint(ATTACK_TASK, "/Script/AIModule.BTTask_BlueprintBase")
    require_blueprint(SPECTATOR_WIDGET, "/Script/UMG.UserWidget")
    require_blueprint(TEST, "/Script/BLA.BLA3v3EliminationTest")

    tree = unreal.load_asset("/Game/BLA/AI/BehaviorTrees/BT_BLABotElimination")
    root = tree.get_editor_property("root_node") if tree else None
    children = root.get_editor_property("children") if root else []
    if len(children) != 4:
        fail("elimination tree must preserve four root priority branches")
    role_selector = children[3].get_editor_property("child_composite")
    role_children = role_selector.get_editor_property("children") if role_selector else []
    if len(role_children) != 4:
        fail("elimination tree role branch must contain three team tasks and tactical fallback")

    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not levels.load_level(MAP):
        fail(f"could not load map {MAP}")
    level_actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    labels = {actor.get_actor_label() for actor in level_actors}
    required_labels = {
        "Attacker Protected Spawn", "Attacker Spawn 2", "Attacker Spawn 3",
        "Defender Protected Spawn", "Defender Spawn 2", "Defender Spawn 3",
        "Attack Route Point", "Guard Point", "Retreat Point",
        "Fixed Spectator Camera", "BLA 3v3 Elimination Functional Test",
    }
    missing = required_labels - labels
    if missing:
        fail(f"map missing required actors {sorted(missing)}")
    spawn_points = [actor for actor in level_actors if isinstance(actor, unreal.BLASpawnPoint)]
    attacker_spawns = [point for point in spawn_points if point.get_editor_property("team") == unreal.BLA_Team.ATTACKERS]
    defender_spawns = [point for point in spawn_points if point.get_editor_property("team") == unreal.BLA_Team.DEFENDERS]
    if len(attacker_spawns) != 3 or len(defender_spawns) != 3:
        fail(f"expected three spawns per team, got attackers={len(attacker_spawns)} defenders={len(defender_spawns)}")

    unreal.log(
        "BLA_TASK8_CONTRACTS_OK native=3 orders=4 team_sizes=3 roles=3 "
        "commands=4 spectator=1 assets=7 spawns=6 tactical_points=3"
    )


main()
