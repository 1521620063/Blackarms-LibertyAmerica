import unreal


ENGINE_INI = unreal.SystemLibrary.get_project_directory() + "Config/DefaultEngine.ini"


def fail(message):
    raise RuntimeError("LAN_CONTRACT_FAILURE " + message)


text = open(ENGINE_INI, encoding="utf-8").read()
if "Port=7777" not in text:
    fail("missing Port=7777")
if "OnlineSubsystemSteam" in text:
    fail("steam subsystem is not allowed")
if getattr(unreal, "BLALanFlowTest", None) is None:
    fail("missing native type unreal.BLALanFlowTest")

world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
tests = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLALanFlowTest)
if not tests:
    fail("BLALanFlowTest missing from bootstrap/editor world")
unreal.log("BLA_LAN_CONTRACTS_OK pending_runtime_marker")
