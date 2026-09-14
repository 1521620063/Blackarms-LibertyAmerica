import unreal


SOURCE_LEVEL = "/Game/FirstPerson/Lvl_FirstPerson"
BOOTSTRAP_LEVEL = "/Game/FPS/Maps/Graybox/L_TestBootstrap"


def main():
    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)

    if not asset_subsystem.does_asset_exist(BOOTSTRAP_LEVEL):
        created = level_editor.new_level_from_template(
            BOOTSTRAP_LEVEL,
            SOURCE_LEVEL,
        )
        if not created:
            raise RuntimeError(f"Failed to create {BOOTSTRAP_LEVEL}")

    if not level_editor.load_level(BOOTSTRAP_LEVEL):
        raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")

    if not level_editor.save_current_level():
        raise RuntimeError(f"Failed to save {BOOTSTRAP_LEVEL}")

    unreal.log(f"FPS_BOOTSTRAP_OK level={BOOTSTRAP_LEVEL}")


main()
