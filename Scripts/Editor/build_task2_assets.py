import unreal


BOOTSTRAP_LEVEL = "/Game/FPS/Maps/Graybox/L_TestBootstrap"
CORE_PATH = "/Game/FPS/Blueprints/Core"

RULES = {
    "DA_FPSMatchRules_Solo": (1, 60.0, 3, 2),
    "DA_FPSMatchRules_2v2": (2, 75.0, 4, 2),
    "DA_FPSMatchRules_3v3": (3, 90.0, 5, 4),
}

DIFFICULTIES = {
    "DA_FPSBotDifficulty_Easy": (0.65, 8.0, 0.35, 900.0, 4.0, 0.45, 0.35),
    "DA_FPSBotDifficulty_Normal": (0.35, 4.0, 0.18, 1400.0, 7.0, 0.70, 0.65),
    "DA_FPSBotDifficulty_Hard": (0.18, 1.5, 0.08, 1800.0, 10.0, 0.90, 0.85),
}

INTERFACES = {
    "BPI_FPSCombatant": {
        "GetTeam": ([], [("ReturnValue", "team")], True),
        "GetIsAlive": ([], [("ReturnValue", "bool")], True),
        "ApplyCombatDamage": (
            [
                ("DamageAmount", "float"),
                ("DamageLocation", "name"),
                ("InstigatorActor", "actor"),
            ],
            [("ReturnValue", "bool")],
            False,
        ),
        "GetCombatantWorldLocation": ([], [("ReturnValue", "vector")], True),
    },
    "BPI_FPSInteractable": {
        "CanInteract": (
            [("Interactor", "actor")],
            [("ReturnValue", "bool")],
            True,
        ),
        "BeginInteraction": (
            [("Interactor", "actor")],
            [("ReturnValue", "bool")],
            False,
        ),
        "CancelInteraction": ([("Interactor", "actor")], [], False),
        "CompleteInteraction": (
            [("Interactor", "actor")],
            [("ReturnValue", "bool")],
            False,
        ),
    },
    "BPI_FPSObjectiveCarrier": {
        "HasObjectiveCore": ([], [("ReturnValue", "bool")], True),
        "GiveObjectiveCore": (
            [("CoreActor", "actor")],
            [("ReturnValue", "bool")],
            False,
        ),
        "RemoveObjectiveCore": ([], [("ReturnValue", "actor")], False),
    },
}


asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_subsystem = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)


def save(asset):
    if not asset_subsystem.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError(f"Failed to save {asset.get_path_name()}")


def get_or_create_blueprint(asset_path, parent_class):
    if asset_subsystem.does_asset_exist(asset_path):
        asset = unreal.load_asset(asset_path)
    else:
        asset = unreal.BlueprintEditorLibrary.create_blueprint_asset_with_parent(
            asset_path, parent_class
        )
    if asset is None:
        raise RuntimeError(f"Failed to create {asset_path}")
    return asset


def get_or_create_interface(name):
    asset_path = f"{CORE_PATH}/{name}"
    if asset_subsystem.does_asset_exist(asset_path):
        asset = unreal.load_asset(asset_path)
    else:
        asset = asset_tools.create_asset(
            name,
            CORE_PATH,
            unreal.Blueprint,
            unreal.BlueprintInterfaceFactory(),
        )
    if asset is None:
        raise RuntimeError(f"Failed to create {asset_path}")
    return asset


def float_type():
    result = unreal.EdGraphPinType()
    if not result.import_text('(PinCategory="real",PinSubCategory="float")'):
        raise RuntimeError("Failed to construct Blueprint float pin type")
    return result


def pin_types():
    team = unreal.EdGraphPinType()
    if not team.import_text(
        '(PinCategory="byte",PinSubCategoryObject="/Script/FPS.EFPS_Team")'
    ):
        raise RuntimeError("Failed to construct EFPS_Team pin type")
    return {
        "team": team,
        "bool": unreal.BlueprintEditorLibrary.get_basic_type_by_name("bool"),
        "float": float_type(),
        "name": unreal.BlueprintEditorLibrary.get_basic_type_by_name("name"),
        "actor": unreal.BlueprintEditorLibrary.get_object_reference_type(unreal.Actor),
        "vector": unreal.BlueprintEditorLibrary.get_struct_type(
            unreal.Vector.static_struct()
        ),
    }


def build_interfaces():
    types = pin_types()
    for interface_name, functions in INTERFACES.items():
        blueprint = get_or_create_interface(interface_name)
        for function_name, (inputs, outputs, is_pure) in functions.items():
            graph = unreal.BlueprintEditorLibrary.find_graph(blueprint, function_name)
            if graph is None:
                editor = unreal.BlueprintGraphEditor.create_and_edit_function_graph(
                    blueprint, function_name
                )
                if editor is None:
                    raise RuntimeError(
                        f"Failed to create {interface_name}.{function_name}"
                    )
                for pin_name, type_name in inputs:
                    editor.add_graph_input_parameter(pin_name, types[type_name])
                for pin_name, type_name in outputs:
                    editor.add_graph_output_parameter(pin_name, types[type_name])
                editor.set_is_pure_function(is_pure)
                editor.set_function_is_public()
        unreal.BlueprintEditorLibrary.compile_blueprint(blueprint)
        save(blueprint)


def create_data_asset(name, package_path, asset_class):
    asset_path = f"{package_path}/{name}"
    if asset_subsystem.does_asset_exist(asset_path):
        asset = unreal.load_asset(asset_path)
    else:
        factory = unreal.DataAssetFactory()
        factory.set_editor_property("data_asset_class", asset_class)
        asset = asset_tools.create_asset(name, package_path, asset_class, factory)
    if asset is None:
        raise RuntimeError(f"Failed to create {package_path}/{name}")
    return asset


def build_rule_assets():
    for name, (team_size, combat, rounds, side_switch) in RULES.items():
        asset = create_data_asset(
            name, "/Game/FPS/Data/Rules", unreal.FPSMatchRulesDataAsset
        )
        rules = unreal.FPSMatchRules()
        rules.set_editor_properties(
            {
                "team_size": team_size,
                "preparation_seconds": 15.0,
                "combat_seconds": combat,
                "plant_seconds": 5.0,
                "defuse_seconds": 5.0,
                "upload_seconds": 30.0,
                "rounds_to_win": rounds,
                "switch_sides_after_round": side_switch,
                "objective_count": 1,
            }
        )
        asset.set_editor_property("rules", rules)
        save(asset)


def build_difficulty_assets():
    fields = [
        "vision_reaction_seconds",
        "aim_error_degrees",
        "fire_delay_seconds",
        "hearing_radius",
        "search_seconds",
        "tactical_execution_probability",
        "team_assist_probability",
    ]
    for name, values in DIFFICULTIES.items():
        asset = create_data_asset(
            name, "/Game/FPS/Data/AI", unreal.FPSBotDifficultyDataAsset
        )
        difficulty = unreal.FPSBotDifficulty()
        difficulty.set_editor_properties(dict(zip(fields, values)))
        asset.set_editor_property("difficulty", difficulty)
        save(asset)


def build_marker_and_validator():
    marker = get_or_create_blueprint(
        f"{CORE_PATH}/BP_FPSGameplayTypes", unreal.Actor
    )
    unreal.BlueprintEditorLibrary.compile_blueprint(marker)
    save(marker)

    validator = get_or_create_blueprint(
        f"{CORE_PATH}/BP_FPSGameplayDataValidator",
        unreal.FPSGameplayDataValidator,
    )
    unreal.BlueprintEditorLibrary.compile_blueprint(validator)
    save(validator)

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not level_editor.load_level(BOOTSTRAP_LEVEL):
        raise RuntimeError(f"Failed to load {BOOTSTRAP_LEVEL}")
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    validator_class = validator.generated_class()
    actors = [
        actor
        for actor in actor_subsystem.get_all_level_actors()
        if actor.get_class() == validator_class
    ]
    if not actors:
        actor = actor_subsystem.spawn_actor_from_class(
            validator_class, unreal.Vector(0.0, 0.0, 300.0), unreal.Rotator()
        )
        if actor is None:
            raise RuntimeError("Failed to spawn gameplay data validator")
        actor.set_actor_label("FPS Gameplay Data Validator")
    elif len(actors) > 1:
        for duplicate in actors[1:]:
            actor_subsystem.destroy_actor(duplicate)
    if not level_editor.save_current_level():
        raise RuntimeError(f"Failed to save {BOOTSTRAP_LEVEL}")


def main():
    build_interfaces()
    build_rule_assets()
    build_difficulty_assets()
    build_marker_and_validator()
    unreal.log("FPS_TASK2_ASSETS_BUILT assets=11 validator_actors=1")


main()
