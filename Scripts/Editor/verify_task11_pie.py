import math

import unreal


MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
MAX_STARTUP_TICKS = 600
VALIDATION_TICKS = 900

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
state = {"ticks": 0, "pie": 0, "ending": False, "start_positions": {}}
handle = None


def finish(success, message):
    log = unreal.log if success else unreal.log_error
    log(f"BLA_TASK11_PIE_DRIVER_{'OK' if success else 'FAILED'} {message}")
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def tick_impl():
    state["ticks"] += 1
    if state["ending"]:
        if not level.is_in_play_in_editor():
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
        return
    if not level.is_in_play_in_editor():
        if state["ticks"] >= MAX_STARTUP_TICKS:
            finish(False, "PIE did not start")
        return
    state["pie"] += 1
    game_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
    if game_world is None:
        return

    tests = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAMapNavigationTest)
    for test in tests:
        # The test retries while runtime navigation data streams in, so only treat a
        # failure as final once its retry window has passed.
        if test.get_editor_property("test_failed") and state["pie"] >= VALIDATION_TICKS:
            start = unreal.Vector(-1200.0, 0.0, 170.0)
            for zone in unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLAMapZone):
                target = zone.get_actor_location()
                path = unreal.NavigationSystemV1.find_path_to_location_synchronously(
                    game_world, start, target)
                points = path.get_editor_property("path_points") if path else []
                unreal.log(
                    f"BLA_TASK11_NAV_DIAG zone={zone.get_editor_property('zone_name')} "
                    f"target={target} path_valid={bool(path and path.is_valid())} points={len(points)}")
            for probe in [unreal.Vector(0.0, 0.0, 20.0), unreal.Vector(0.0, 300.0, 20.0),
                          unreal.Vector(0.0, -300.0, 20.0), unreal.Vector(120.0, 0.0, 20.0),
                          unreal.Vector(-120.0, 0.0, 20.0), unreal.Vector(0.0, 0.0, 150.0)]:
                probe_path = unreal.NavigationSystemV1.find_path_to_location_synchronously(
                    game_world, start, probe)
                probe_points = probe_path.get_editor_property("path_points") if probe_path else []
                unreal.log(
                    f"BLA_TASK11_NAV_PROBE target={probe} path_valid={bool(probe_path and probe_path.is_valid())} points={len(probe_points)}")
            for block in unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.StaticMeshActor):
                location = block.get_actor_location()
                if abs(location.x) <= 600.0 and abs(location.y) <= 700.0:
                    unreal.log(
                        f"BLA_TASK11_BLOCK label={block.get_actor_label()} location={location} scale={block.get_actor_scale3d()}")
            finish(False, f"navigation reason={test.get_editor_property('failure_reason')}")
            return

    if not state["start_positions"] and state["pie"] >= 5:
        bots = unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLABotCharacter)
        if bots:
            state["start_positions"] = {bot.get_path_name(): bot.get_actor_location() for bot in bots}

    if state["pie"] < VALIDATION_TICKS:
        return

    if not tests or not tests[0].get_editor_property("test_succeeded"):
        finish(False, f"navigation test incomplete count={len(tests)}")
        return

    moved = 0.0
    for bot in unreal.GameplayStatics.get_all_actors_of_class(game_world, unreal.BLABotCharacter):
        start = state["start_positions"].get(bot.get_path_name())
        if start is None:
            continue
        current = bot.get_actor_location()
        moved = max(moved, math.sqrt((current.x - start.x) ** 2 + (current.y - start.y) ** 2 + (current.z - start.z) ** 2))
    if moved < 100.0:
        finish(False, f"bots did not play the map moved={moved:.1f}")
        return
    finish(True, f"ticks={state['pie']} navigation=1 moved={moved:.1f}")


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        finish(False, f"driver_error {error}")


if not level.load_level(MAP):
    raise RuntimeError(f"Failed to load {MAP}")
handle = unreal.register_slate_post_tick_callback(tick)
level.editor_request_begin_play()
unreal.log("BLA_TASK11_PIE_DRIVER_STARTED")
