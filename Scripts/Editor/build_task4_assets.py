import unreal


WEAPON_PATH = "/Game/FPS/Blueprints/Weapons"
DATA_PATH = "/Game/FPS/Data/Weapons"
TEST_PATH = "/Game/FPS/Tests"
BOOTSTRAP_LEVEL = "/Game/FPS/Maps/Graybox/L_TestBootstrap"

WEAPONS = {
    "EnergyPistol": {
        "weapon_type": unreal.FPS_WeaponType.ENERGY_PISTOL,
        "base_damage": 25.0,
        "rounds_per_minute": 300.0,
        "magazine_capacity": 12,
        "reserve_ammo": 48,
        "reload_seconds": 1.2,
        "max_range": 8000.0,
        "range_falloff": 0.65,
        "aim_spread_degrees": 0.35,
        "ai_preferred_range": 1800.0,
    },
    "PulseRifle": {
        "weapon_type": unreal.FPS_WeaponType.PULSE_RIFLE,
        "base_damage": 18.0,
        "rounds_per_minute": 600.0,
        "magazine_capacity": 24,
        "reserve_ammo": 96,
        "reload_seconds": 1.8,
        "max_range": 12000.0,
        "range_falloff": 0.75,
        "aim_spread_degrees": 0.5,
        "ai_preferred_range": 3500.0,
    },
    "ScatterGun": {
        "weapon_type": unreal.FPS_WeaponType.SCATTER_GUN,
        "base_damage": 80.0,
        "rounds_per_minute": 75.0,
        "magazine_capacity": 6,
        "reserve_ammo": 24,
        "reload_seconds": 2.2,
        "max_range": 5000.0,
        "range_falloff": 0.2,
        "aim_spread_degrees": 6.0,
        "ai_preferred_range": 1000.0,
    },
}

BLUEPRINTS = {
    "BP_FPSWeaponBase": unreal.FPSWeaponBase,
    "BP_FPSWeaponComponent": unreal.FPSWeaponComponent,
    "BP_FPSDamageResolver": unreal.FPSDamageResolver,
    "BP_FPSHitFeedbackComponent": unreal.FPSHitFeedbackComponent,
}

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)


def save(asset):
    if not asset_subsystem.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")


def blueprint(path, parent):
    if asset_subsystem.does_asset_exist(path):
        result = unreal.load_asset(path)
    else:
        result = unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(
            path, parent
        )
    if result is None:
        raise RuntimeError(f"Failed to create {path}")
    return result


def data_asset(name, values):
    path = f"{DATA_PATH}/DA_FPSWeapon_{name}"
    if asset_subsystem.does_asset_exist(path):
        asset = unreal.load_asset(path)
    else:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", unreal.FPSWeaponDataAsset)
        asset = asset_tools.create_asset(
            f"DA_FPSWeapon_{name}", DATA_PATH, unreal.FPSWeaponDataAsset, factory
        )
    if asset is None:
        raise RuntimeError(f"Failed to create {path}")
    data = unreal.FPSWeaponData()
    values = dict(values)
    values.update(
        {
            "weak_point_multiplier": 2.0,
            "body_multiplier": 1.0,
            "limb_multiplier": 0.75,
        }
    )
    data.set_editor_properties(values)
    asset.set_editor_property("weapon_data", data)
    save(asset)
    return asset


def build_assets():
    for name, parent in BLUEPRINTS.items():
        result = blueprint(f"{WEAPON_PATH}/{name}", parent)
        unreal.BlueprintEditorLibrary.compile_blueprint(result)
        save(result)

    for weapon_name, values in WEAPONS.items():
        asset = data_asset(weapon_name, values)
        result = blueprint(
            f"{WEAPON_PATH}/BP_FPSWeapon_{weapon_name}", unreal.FPSWeaponBase
        )
        cdo = unreal.get_default_object(result.generated_class())
        cdo.set_editor_property("weapon_data_asset", asset)
        unreal.BlueprintEditorLibrary.compile_blueprint(result)
        save(result)


def place_validator():
    result = blueprint(f"{TEST_PATH}/BP_FPSWeaponTestActor", unreal.FPSWeaponTestActor)
    unreal.BlueprintEditorLibrary.compile_blueprint(result)
    save(result)

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not level_editor.load_level(BOOTSTRAP_LEVEL):
        raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    validator_class = result.generated_class()
    matches = [
        actor for actor in actors.get_all_level_actors()
        if actor.get_class() == validator_class
    ]
    if not matches:
        actor = actors.spawn_actor_from_class(
            validator_class, unreal.Vector(0.0, 0.0, 450.0), unreal.Rotator()
        )
        if actor is None:
            raise RuntimeError("Failed to place weapon validator")
        actor.set_actor_label("FPS Weapon Test Actor")
    elif len(matches) > 1:
        for duplicate in matches[1:]:
            actors.destroy_actor(duplicate)
    if not level_editor.save_current_level():
        raise RuntimeError(f"Failed to save {BOOTSTRAP_LEVEL}")


def main():
    build_assets()
    place_validator()
    unreal.log("FPS_TASK4_ASSETS_BUILT blueprints=8 data_assets=3 validators=1")


main()
