import unreal


MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
CONFIG_ASSET = "/Game/BLA/Data/Maps/DA_BLAMapConfig_ZeroFacility"
CONFIG_BLUEPRINT = "/Game/BLA/Blueprints/Maps/BP_BLAMapConfig"
ZONE_BLUEPRINT = "/Game/BLA/Blueprints/Maps/BP_BLAMapZone"
TEST_BLUEPRINT = "/Game/BLA/Tests/FT_BLA_MapNavigation"

EXPECTED_ZONES = [
    ("AttackSpawn", unreal.BLA_MapZoneType.ATTACK_SPAWN),
    ("LeftRoute", unreal.BLA_MapZoneType.LEFT_ROUTE),
    ("CenterRoute", unreal.BLA_MapZoneType.CENTER_ROUTE),
    ("RightRoute", unreal.BLA_MapZoneType.RIGHT_ROUTE),
    ("MidCombatZone", unreal.BLA_MapZoneType.MID_COMBAT_ZONE),
    ("ObjectiveZone", unreal.BLA_MapZoneType.OBJECTIVE_ZONE),
    ("FlankZone", unreal.BLA_MapZoneType.FLANK_ZONE),
    ("DefenseSpawn", unreal.BLA_MapZoneType.DEFENSE_SPAWN),
]

EXPECTED_TACTICAL = [
    unreal.BLA_TacticalPointType.COVER_POINT,
    unreal.BLA_TacticalPointType.GUARD_POINT,
    unreal.BLA_TacticalPointType.ATTACK_POINT,
    unreal.BLA_TacticalPointType.FLANK_POINT,
    unreal.BLA_TacticalPointType.RETREAT_POINT,
    unreal.BLA_TacticalPointType.PLANT_POINT,
    unreal.BLA_TacticalPointType.DEFUSE_POINT,
]

MIN_COVER = 12


def fail(message):
    raise RuntimeError("TASK11_CONTRACT_FAILURE " + message)


def main():
    for name in ["BLAMapZone", "BLAMapConfig", "BLAMapConfigDataAsset", "BLAMapNavigationTest", "BLA_MapZoneType"]:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    for path, parent_name in [
        (ZONE_BLUEPRINT, "/Script/BLA.BLAMapZone"),
        (CONFIG_BLUEPRINT, "/Script/BLA.BLAMapConfig"),
        (TEST_BLUEPRINT, "/Script/BLA.BLAMapNavigationTest"),
    ]:
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != parent_name:
            fail(f"{path} parent: got {parent.get_path_name()}")

    config = unreal.load_asset(CONFIG_ASSET)
    if config is None:
        fail(f"missing {CONFIG_ASSET}")
    if str(config.get_editor_property("map_id")) != "ZeroFacility":
        fail("map config id mismatch")
    modes = list(config.get_editor_property("supported_modes"))
    if unreal.BLA_MatchMode.TEAM_ELIMINATION not in modes or unreal.BLA_MatchMode.DATA_CORE_ATTACK_DEFENSE not in modes:
        fail(f"map config modes: {modes}")
    sizes = list(config.get_editor_property("supported_team_sizes"))
    if sizes != [1, 2, 3]:
        fail(f"map config team sizes: {sizes}")
    if config.get_editor_property("spawn_points_per_team") < 3:
        fail("map config spawn points per team must be >= 3")
    if not config.get_editor_property("supports_objective"):
        fail("map config must support the objective")

    if not unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).load_level(MAP):
        fail(f"could not load {MAP}")
    level_actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()

    zones = [actor for actor in level_actors if isinstance(actor, unreal.BLAMapZone)]
    zone_types = {}
    for zone in zones:
        zone_types[zone.get_editor_property("zone_type")] = str(zone.get_editor_property("zone_name"))
    for expected_name, expected_type in EXPECTED_ZONES:
        if zone_types.get(expected_type) != expected_name:
            fail(f"zone {expected_name}: got {zone_types.get(expected_type)}")

    spawns = [actor for actor in level_actors if isinstance(actor, unreal.BLASpawnPoint)]
    attackers = [spawn for spawn in spawns if spawn.get_editor_property("team") == unreal.BLA_Team.ATTACKERS]
    defenders = [spawn for spawn in spawns if spawn.get_editor_property("team") == unreal.BLA_Team.DEFENDERS]
    if len(attackers) < 3 or len(defenders) < 3:
        fail(f"spawn counts attack={len(attackers)} defense={len(defenders)}")

    tactical = [actor for actor in level_actors if isinstance(actor, unreal.BLATacticalPoint)]
    tactical_types = {point.get_editor_property("point_type") for point in tactical}
    missing_types = [str(point_type) for point_type in EXPECTED_TACTICAL if point_type not in tactical_types]
    if missing_types:
        fail(f"tactical point types missing {missing_types}")

    cover = [actor for actor in level_actors if actor.get_actor_label().startswith(("Mid ", "Objective ", "Left ", "Right ", "Center "))]
    if len(cover) < MIN_COVER:
        fail(f"cover pieces={len(cover)}")

    config_actors = [actor for actor in level_actors if isinstance(actor, unreal.BLAMapConfig)]
    if len(config_actors) != 1:
        fail(f"map config actor count={len(config_actors)}")
    config_actor = config_actors[0]
    if config_actor.get_editor_property("config") is None:
        fail("map config actor has no data asset")
    if len(list(config_actor.get_editor_property("zones"))) != len(zones):
        fail("map config actor does not reference every zone")
    if config_actor.get_editor_property("objective_manager") is None:
        fail("map config actor has no objective manager")
    if config_actor.get_editor_property("data_core") is None or config_actor.get_editor_property("objective_zone") is None:
        fail("map config actor has no objective targets")

    managers = [actor for actor in level_actors if isinstance(actor, unreal.BLAObjectiveManager)]
    if len(managers) != 1 or not managers[0].actor_has_tag("BLALevelObjectiveManager"):
        fail(f"level objective manager count={len(managers)}")
    if managers[0].get_editor_property("data_core") is None or managers[0].get_editor_property("objective_zone") is None:
        fail("level objective manager is not wired")

    nav_bounds = [actor for actor in level_actors if isinstance(actor, unreal.NavMeshBoundsVolume)]
    if len(nav_bounds) != 1:
        fail(f"navmesh bounds count={len(nav_bounds)}")
    tests = [actor for actor in level_actors if isinstance(actor, unreal.BLAMapNavigationTest)]
    if len(tests) != 1:
        fail(f"navigation test count={len(tests)}")

    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    default_mode = world.get_world_settings().get_editor_property("default_game_mode")
    if default_mode is None or "BP_BLAGameMode_Elimination" not in default_mode.get_path_name():
        fail(f"map default game mode: {default_mode}")

    unreal.log("BLA_TASK11_CONTRACTS_OK zones=8 spawns=6 tactical=7 cover=%d config=1 objective=1 nav_test=1 modes=2 sizes=3" % len(cover))


main()
