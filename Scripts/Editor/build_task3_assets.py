import unreal


CHARACTER_PATH = "/Game/BLA/Blueprints/Characters"
INPUT_PATH = f"{CHARACTER_PATH}/Input"
TEST_PATH = "/Game/BLA/Tests"
BOOTSTRAP_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
COMBATANT_INTERFACE = "/Game/BLA/Blueprints/Core/BPI_BLACombatant"

BLUEPRINTS = {
    "BP_BLACharacterBase": unreal.BLACharacterBase,
    "BP_BLAPlayerCharacter": unreal.BLAPlayerCharacter,
    "BP_BLABotCharacter": unreal.BLABotCharacter,
    "BP_BLAHealthComponent": unreal.BLAHealthComponent,
    "BP_BLAInteractionComponent": unreal.BLAInteractionComponent,
    "BP_BLAPlayerController": unreal.BLAPlayerController,
    "BP_BLAPlayerState": unreal.BLAPlayerState,
}

ACTION_TYPES = {
    "IA_Move": unreal.InputActionValueType.AXIS2D,
    "IA_Look": unreal.InputActionValueType.AXIS2D,
    "IA_Jump": unreal.InputActionValueType.BOOLEAN,
    "IA_Fire": unreal.InputActionValueType.BOOLEAN,
    "IA_Reload": unreal.InputActionValueType.BOOLEAN,
    "IA_SwitchPrimary": unreal.InputActionValueType.BOOLEAN,
    "IA_SwitchSecondary": unreal.InputActionValueType.BOOLEAN,
    "IA_Command": unreal.InputActionValueType.BOOLEAN,
}

MAPPINGS = [
    ("IA_Move", "W", "positive_y"),
    ("IA_Move", "A", "negative_x"),
    ("IA_Move", "S", "negative_y"),
    ("IA_Move", "D", None),
    ("IA_Look", "Mouse2D", None),
    ("IA_Jump", "SpaceBar", None),
    ("IA_Fire", "LeftMouseButton", None),
    ("IA_Reload", "R", None),
    ("IA_SwitchPrimary", "One", None),
    ("IA_SwitchSecondary", "Two", None),
    ("IA_Command", "Q", None),
]

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)


def save(asset):
    if not asset_subsystem.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")


def create_blueprints():
    created = {}
    for name, parent in BLUEPRINTS.items():
        path = f"{CHARACTER_PATH}/{name}"
        if asset_subsystem.does_asset_exist(path):
            blueprint = unreal.load_asset(path)
        else:
            blueprint = unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(
                path, parent
            )
        if blueprint is None:
            raise RuntimeError(f"Failed to create {path}")
        created[name] = blueprint

    interface = unreal.load_asset(COMBATANT_INTERFACE)
    if interface is None:
        raise RuntimeError(f"Missing {COMBATANT_INTERFACE}")
    if not unreal.BLABlueprintAssetBuilder.add_blueprint_interface(
        created["BP_BLACharacterBase"], interface.generated_class()
    ):
        raise RuntimeError("Failed to add BPI_BLACombatant to BP_BLACharacterBase")

    for blueprint in created.values():
        unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
        save(blueprint)


def create_input_action(name, value_type):
    path = f"{INPUT_PATH}/{name}"
    if asset_subsystem.does_asset_exist(path):
        action = unreal.load_asset(path)
    else:
        action = asset_tools.create_asset(
            name, INPUT_PATH, unreal.InputAction, unreal.InputAction_Factory()
        )
    if action is None:
        raise RuntimeError(f"Failed to create {path}")
    action.set_editor_property("value_type", value_type)
    save(action)
    return action


def key(name):
    result = unreal.Key()
    result.set_editor_property("key_name", name)
    return result


def mapping_modifiers(mode, context):
    if mode is None:
        return []

    modifiers = []
    if mode in {"positive_y", "negative_y"}:
        swizzle = unreal.new_object(unreal.InputModifierSwizzleAxis, outer=context)
        swizzle.set_editor_property(
            "order", unreal.InputAxisSwizzle.YXZ
        )
        modifiers.append(swizzle)
    if mode in {"negative_x", "negative_y"}:
        modifiers.insert(0, unreal.new_object(unreal.InputModifierNegate, outer=context))
    return modifiers


def create_mapping_context(actions):
    name = "IMC_BLAPlayer"
    path = f"{INPUT_PATH}/{name}"
    if asset_subsystem.does_asset_exist(path):
        context = unreal.load_asset(path)
    else:
        context = asset_tools.create_asset(
            name,
            INPUT_PATH,
            unreal.InputMappingContext,
            unreal.InputMappingContext_Factory(),
        )
    if context is None:
        raise RuntimeError(f"Failed to create {path}")

    mappings = []
    for action_name, key_name, modifier_mode in MAPPINGS:
        mapping = unreal.EnhancedActionKeyMapping()
        mapping.set_editor_properties(
            {
                "action": actions[action_name],
                "key": key(key_name),
                "modifiers": mapping_modifiers(modifier_mode, context),
            }
        )
        mappings.append(mapping)
    mapping_data = unreal.InputMappingContextMappingData()
    mapping_data.set_editor_property("mappings", mappings)
    context.set_editor_property("default_key_mappings", mapping_data)
    save(context)


def place_runtime_validator():
    path = f"{TEST_PATH}/BP_BLACharacterFoundationValidator"
    if asset_subsystem.does_asset_exist(path):
        blueprint = unreal.load_asset(path)
    else:
        blueprint = unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(
            path, unreal.BLACharacterFoundationValidator
        )
    if blueprint is None:
        raise RuntimeError(f"Failed to create {path}")
    unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
    save(blueprint)

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not level_editor.load_level(BOOTSTRAP_LEVEL):
        raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    validator_class = blueprint.generated_class()
    actors = [
        actor
        for actor in actor_subsystem.get_all_level_actors()
        if actor.get_class() == validator_class
    ]
    if not actors:
        actor = actor_subsystem.spawn_actor_from_class(
            validator_class, unreal.Vector(0.0, 0.0, 350.0), unreal.Rotator()
        )
        if actor is None:
            raise RuntimeError("Failed to place character foundation validator")
        actor.set_actor_label("BLA Character Foundation Validator")
    elif len(actors) > 1:
        for duplicate in actors[1:]:
            actor_subsystem.destroy_actor(duplicate)
    if not level_editor.save_current_level():
        raise RuntimeError(f"Failed to save {BOOTSTRAP_LEVEL}")


def main():
    create_blueprints()
    actions = {
        name: create_input_action(name, value_type)
        for name, value_type in ACTION_TYPES.items()
    }
    create_mapping_context(actions)
    place_runtime_validator()
    unreal.log("BLA_TASK3_ASSETS_BUILT blueprints=8 actions=8 mappings=11 validators=1")


main()
