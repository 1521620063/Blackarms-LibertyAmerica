import unreal


CHARACTER_PATH = "/Game/BLA/Blueprints/Characters"
INPUT_PATH = f"{CHARACTER_PATH}/Input"

BLUEPRINTS = {
    "BP_BLACharacterBase": "/Script/BLA.BLACharacterBase",
    "BP_BLAPlayerCharacter": "/Script/BLA.BLAPlayerCharacter",
    "BP_BLABotCharacter": "/Script/BLA.BLABotCharacter",
    "BP_BLAHealthComponent": "/Script/BLA.BLAHealthComponent",
    "BP_BLAInteractionComponent": "/Script/BLA.BLAInteractionComponent",
    "BP_BLAPlayerController": "/Script/BLA.BLAPlayerController",
    "BP_BLAPlayerState": "/Script/BLA.BLAPlayerState",
}

INPUT_ACTIONS = {
    "IA_Move": unreal.InputActionValueType.AXIS2D,
    "IA_Look": unreal.InputActionValueType.AXIS2D,
    "IA_Jump": unreal.InputActionValueType.BOOLEAN,
    "IA_Fire": unreal.InputActionValueType.BOOLEAN,
    "IA_Reload": unreal.InputActionValueType.BOOLEAN,
    "IA_SwitchPrimary": unreal.InputActionValueType.BOOLEAN,
    "IA_SwitchSecondary": unreal.InputActionValueType.BOOLEAN,
    "IA_Command": unreal.InputActionValueType.BOOLEAN,
}

EXPECTED_KEYS = {
    "IA_Move": {"W", "A", "S", "D"},
    "IA_Look": {"Mouse2D"},
    "IA_Jump": {"SpaceBar"},
    "IA_Fire": {"LeftMouseButton"},
    "IA_Reload": {"R"},
    "IA_SwitchPrimary": {"One"},
    "IA_SwitchSecondary": {"Two"},
    "IA_Command": {"Q"},
}

EXPECTED_MOVE_MODIFIERS = {
    "W": ["InputModifierSwizzleAxis"],
    "A": ["InputModifierNegate"],
    "S": ["InputModifierNegate", "InputModifierSwizzleAxis"],
    "D": [],
}


def fail(message):
    raise RuntimeError("TASK3_CONTRACT_FAILURE " + message)


def verify_native_contracts():
    required = [
        "BLAHealthComponent",
        "BLAInteractionComponent",
        "BLACharacterBase",
        "BLAPlayerCharacter",
        "BLABotCharacter",
        "BLAPlayerController",
        "BLAPlayerState",
    ]
    for name in required:
        if getattr(unreal, name, None) is None:
            fail(f"missing native type unreal.{name}")

    health = unreal.BLAHealthComponent()
    expected_health = {
        "max_health": 100.0,
        "current_health": 100.0,
        "armor_value": 0.0,
        "is_dead": False,
    }
    for field, expected in expected_health.items():
        actual = health.get_editor_property(field)
        if actual != expected:
            fail(f"health default {field}: expected {expected}, got {actual}")

    player_state = unreal.BLAPlayerState()
    for field in [
        "team",
        "death_state",
        "kills",
        "deaths",
        "damage_dealt",
        "objective_contribution",
    ]:
        try:
            player_state.get_editor_property(field)
        except Exception as error:
            fail(f"player state missing {field}: {error}")


def verify_blueprints():
    loaded = {}
    for name, expected_parent in BLUEPRINTS.items():
        path = f"{CHARACTER_PATH}/{name}"
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing Blueprint {path}")
        parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(blueprint)
        if parent.get_path_name() != expected_parent:
            fail(f"{path} parent: expected {expected_parent}, got {parent.get_path_name()}")
        loaded[name] = blueprint

    interface = unreal.load_asset(
        "/Game/BLA/Blueprints/Core/BPI_BLACombatant"
    ).generated_class()
    character_cdo = unreal.get_default_object(
        loaded["BP_BLACharacterBase"].generated_class()
    )
    if not unreal.SystemLibrary.does_implement_interface(character_cdo, interface):
        fail("BP_BLACharacterBase does not implement BPI_BLACombatant")


def verify_input_assets():
    actions = {}
    for name, expected_value_type in INPUT_ACTIONS.items():
        path = f"{INPUT_PATH}/{name}"
        action = unreal.load_asset(path)
        if action is None:
            fail(f"missing input action {path}")
        actual = action.get_editor_property("value_type")
        if actual != expected_value_type:
            fail(f"{path} value type: expected {expected_value_type}, got {actual}")
        actions[name] = action

    context_path = f"{INPUT_PATH}/IMC_BLAPlayer"
    context = unreal.load_asset(context_path)
    if context is None:
        fail(f"missing input mapping context {context_path}")

    actual_keys = {name: set() for name in INPUT_ACTIONS}
    move_modifiers = {}
    mapping_data = context.get_editor_property("default_key_mappings")
    for mapping in mapping_data.get_editor_property("mappings"):
        action = mapping.get_editor_property("action")
        if action is None or action.get_name() not in actual_keys:
            continue
        key = mapping.get_editor_property("key")
        key_name = str(key.get_editor_property("key_name"))
        actual_keys[action.get_name()].add(key_name)
        if action.get_name() == "IA_Move":
            move_modifiers[key_name] = [
                modifier.get_class().get_name()
                for modifier in mapping.get_editor_property("modifiers")
            ]

    for action_name, expected in EXPECTED_KEYS.items():
        if actual_keys[action_name] != expected:
            fail(
                f"{context_path}.{action_name} keys: expected {expected}, "
                f"got {actual_keys[action_name]}"
            )

    if move_modifiers != EXPECTED_MOVE_MODIFIERS:
        fail(
            f"{context_path}.IA_Move modifiers: expected "
            f"{EXPECTED_MOVE_MODIFIERS}, got {move_modifiers}"
        )


def main():
    verify_native_contracts()
    verify_blueprints()
    verify_input_assets()
    unreal.log("BLA_TASK3_CONTRACTS_OK native=7 blueprints=7 actions=8 mappings=11")


main()
