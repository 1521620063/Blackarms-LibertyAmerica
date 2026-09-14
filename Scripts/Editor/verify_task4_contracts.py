import math

import unreal


WEAPON_PATH = "/Game/BLA/Blueprints/Weapons"
DATA_PATH = "/Game/BLA/Data/Weapons"
TEST_PATH = "/Game/BLA/Tests"

BLUEPRINTS = {
    "BP_BLAWeaponBase": "/Script/BLA.BLAWeaponBase",
    "BP_BLAWeaponComponent": "/Script/BLA.BLAWeaponComponent",
    "BP_BLAWeapon_EnergyPistol": "/Script/BLA.BLAWeaponBase",
    "BP_BLAWeapon_PulseRifle": "/Script/BLA.BLAWeaponBase",
    "BP_BLAWeapon_ScatterGun": "/Script/BLA.BLAWeaponBase",
    "BP_BLADamageResolver": "/Script/BLA.BLADamageResolver",
    "BP_BLAHitFeedbackComponent": "/Script/BLA.BLAHitFeedbackComponent",
}

WEAPON_DATA = {
    "DA_BLAWeapon_EnergyPistol": (unreal.BLA_WeaponType.ENERGY_PISTOL, 12),
    "DA_BLAWeapon_PulseRifle": (unreal.BLA_WeaponType.PULSE_RIFLE, 24),
    "DA_BLAWeapon_ScatterGun": (unreal.BLA_WeaponType.SCATTER_GUN, 6),
}

# Full payload per plan "Weapon data" so a numeric edit cannot drift silently.
WEAPON_NUMBERS = {
    "DA_BLAWeapon_EnergyPistol": {
        "base_damage": 25.0,
        "rounds_per_minute": 300.0,
        "reserve_ammo": 48,
        "reload_seconds": 1.2,
        "max_range": 8000.0,
        "range_falloff": 0.65,
        "aim_spread_degrees": 0.35,
        "ai_preferred_range": 1800.0,
    },
    "DA_BLAWeapon_PulseRifle": {
        "base_damage": 18.0,
        "rounds_per_minute": 600.0,
        "reserve_ammo": 96,
        "reload_seconds": 1.8,
        "max_range": 12000.0,
        "range_falloff": 0.75,
        "aim_spread_degrees": 0.5,
        "ai_preferred_range": 3500.0,
    },
    "DA_BLAWeapon_ScatterGun": {
        "base_damage": 80.0,
        "rounds_per_minute": 75.0,
        "reserve_ammo": 24,
        "reload_seconds": 2.2,
        "max_range": 5000.0,
        "range_falloff": 0.2,
        "aim_spread_degrees": 6.0,
        "ai_preferred_range": 1000.0,
    },
}


def fail(message):
    raise RuntimeError("TASK4_CONTRACT_FAILURE " + message)


def verify_native_contracts():
    required = [
        "BLAWeaponDataAsset",
        "BLAWeaponBase",
        "BLAWeaponComponent",
        "BLADamageResolver",
        "BLAHitFeedbackComponent",
        "BLAWeaponTestActor",
    ]
    for name in required:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    data = unreal.BLAWeaponDataAsset()
    weapon = data.get_editor_property("weapon_data")
    for field in [
        "weapon_type",
        "base_damage",
        "weak_point_multiplier",
        "body_multiplier",
        "limb_multiplier",
        "rounds_per_minute",
        "magazine_capacity",
        "reserve_ammo",
        "reload_seconds",
        "max_range",
        "range_falloff",
        "aim_spread_degrees",
        "ai_preferred_range",
    ]:
        try:
            weapon.get_editor_property(field)
        except Exception as error:
            fail(f"weapon data missing {field}: {error}")


def verify_blueprints():
    for name, expected_parent in BLUEPRINTS.items():
        path = f"{WEAPON_PATH}/{name}"
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != expected_parent:
            fail(f"{path} parent: expected {expected_parent}, got {parent.get_path_name()}")

    test_path = f"{TEST_PATH}/BP_BLAWeaponTestActor"
    blueprint = unreal.load_asset(test_path)
    if blueprint is None:
        fail(f"missing Blueprint {test_path}")
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
    if parent.get_path_name() != "/Script/BLA.BLAWeaponTestActor":
        fail(f"{test_path} has unexpected parent {parent.get_path_name()}")


def verify_data_assets():
    for name, (expected_type, expected_magazine) in WEAPON_DATA.items():
        path = f"{DATA_PATH}/{name}"
        asset = unreal.load_asset(path)
        if asset is None:
            fail(f"missing weapon data asset {path}")
        data = asset.get_editor_property("weapon_data")
        actual_type = data.get_editor_property("weapon_type")
        actual_magazine = data.get_editor_property("magazine_capacity")
        if actual_type != expected_type:
            fail(f"{path} weapon type: expected {expected_type}, got {actual_type}")
        if actual_magazine != expected_magazine:
            fail(
                f"{path} magazine: expected {expected_magazine}, got {actual_magazine}"
            )
        if data.get_editor_property("weak_point_multiplier") != 2.0:
            fail(f"{path} weak point multiplier must be 2.0")
        if data.get_editor_property("body_multiplier") != 1.0:
            fail(f"{path} body multiplier must be 1.0")
        if data.get_editor_property("limb_multiplier") != 0.75:
            fail(f"{path} limb multiplier must be 0.75")
        for field, expected in WEAPON_NUMBERS[name].items():
            actual = data.get_editor_property(field)
            if not math.isclose(actual, expected, rel_tol=1e-6, abs_tol=1e-6):
                fail(f"{path} {field}: expected {expected}, got {actual}")


def main():
    verify_native_contracts()
    verify_blueprints()
    verify_data_assets()
    unreal.log("BLA_TASK4_CONTRACTS_OK native=6 blueprints=8 data_assets=3")


main()
