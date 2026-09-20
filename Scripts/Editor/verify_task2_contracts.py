import math
import unreal


BOOTSTRAP_LEVEL = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
VALIDATOR_PATH = "/Game/BLA/Blueprints/Core/BP_BLAGameplayDataValidator"

ENUMS = {
    "BLA_Team": ["ATTACKERS", "DEFENDERS", "NEUTRAL"],
    "BLA_MatchMode": ["TEAM_ELIMINATION", "DATA_CORE_ATTACK_DEFENSE"],
    "BLA_RoundPhase": [
        "LOADING",
        "PREPARATION",
        "COMBAT",
        "OBJECTIVE_UPLOAD",
        "ROUND_RESULT",
        "MATCH_RESULT",
        "WAITING",
    ],
    "BLA_BotRole": ["ASSAULT", "SUPPORT", "DEFENDER"],
    "BLA_WeaponType": ["ENERGY_PISTOL", "PULSE_RIFLE", "SCATTER_GUN"],
    "BLA_ObjectiveState": [
        "NONE",
        "AVAILABLE",
        "CARRIED",
        "DROPPED",
        "PLANTING",
        "PLANTED",
        "UPLOADING",
        "DEFUSING",
        "DEFUSED",
        "COMPLETED",
    ],
    "BLA_DeathState": ["ALIVE", "DEAD", "SPECTATING"],
}

STRUCT_FIELDS = {
    "BLAMatchRules": {
        "team_size",
        "preparation_seconds",
        "combat_seconds",
        "plant_seconds",
        "defuse_seconds",
        "upload_seconds",
        "rounds_to_win",
        "switch_sides_after_round",
        "objective_count",
    },
    "BLABotDifficulty": {
        "vision_reaction_seconds",
        "aim_error_degrees",
        "fire_delay_seconds",
        "hearing_radius",
        "search_seconds",
        "tactical_execution_probability",
        "team_assist_probability",
    },
}

RULES = {
    "/Game/BLA/Data/Rules/DA_BLAMatchRules_Solo": (1, 60.0, 3, 2),
    "/Game/BLA/Data/Rules/DA_BLAMatchRules_2v2": (2, 75.0, 4, 2),
    "/Game/BLA/Data/Rules/DA_BLAMatchRules_3v3": (3, 90.0, 5, 4),
}

DIFFICULTIES = {
    "/Game/BLA/Data/AI/DA_BLABotDifficulty_Easy": (
        0.65,
        8.0,
        0.35,
        900.0,
        4.0,
        0.45,
        0.35,
    ),
    "/Game/BLA/Data/AI/DA_BLABotDifficulty_Normal": (
        0.35,
        4.0,
        0.18,
        1400.0,
        7.0,
        0.70,
        0.65,
    ),
    "/Game/BLA/Data/AI/DA_BLABotDifficulty_Hard": (
        0.18,
        1.5,
        0.08,
        1800.0,
        10.0,
        0.90,
        0.85,
    ),
}

INTERFACES = {
    "/Game/BLA/Blueprints/Core/BPI_BLACombatant": {
        "GetTeam": ({}, {"ReturnValue": ("byte", "EBLA_Team")}),
        "GetIsAlive": ({}, {"ReturnValue": ("bool", None)}),
        "ApplyCombatDamage": (
            {
                "DamageAmount": ("real", 'PinSubCategory="float"'),
                "DamageLocation": ("name", None),
                "InstigatorActor": ("object", "Actor"),
            },
            {"ReturnValue": ("bool", None)},
        ),
        "GetCombatantWorldLocation": ({}, {"ReturnValue": ("struct", "Vector")}),
    },
    "/Game/BLA/Blueprints/Core/BPI_BLAInteractable": {
        "CanInteract": (
            {"Interactor": ("object", "Actor")},
            {"ReturnValue": ("bool", None)},
        ),
        "BeginInteraction": (
            {"Interactor": ("object", "Actor")},
            {"ReturnValue": ("bool", None)},
        ),
        "CancelInteraction": ({"Interactor": ("object", "Actor")}, {}),
        "CompleteInteraction": (
            {"Interactor": ("object", "Actor")},
            {"ReturnValue": ("bool", None)},
        ),
    },
    "/Game/BLA/Blueprints/Core/BPI_BLAObjectiveCarrier": {
        "HasObjectiveCore": ({}, {"ReturnValue": ("bool", None)}),
        "GiveObjectiveCore": (
            {"CoreActor": ("object", "Actor")},
            {"ReturnValue": ("bool", None)},
        ),
        "RemoveObjectiveCore": ({}, {"ReturnValue": ("object", "Actor")}),
    },
}


def fail(message):
    raise RuntimeError("TASK2_CONTRACT_FAILURE " + message)


def assert_close(actual, expected, label):
    if not math.isclose(float(actual), float(expected), rel_tol=1e-5, abs_tol=1e-5):
        fail(f"{label}: expected {expected}, got {actual}")


def verify_enums_and_structs():
    for python_name, expected in ENUMS.items():
        enum_type = getattr(unreal, python_name, None)
        if enum_type is None:
            fail(f"missing enum {python_name}")
        actual = [value.name for value in enum_type]
        if actual != expected:
            fail(f"{python_name}: expected {expected}, got {actual}")

    for struct_name, expected_fields in STRUCT_FIELDS.items():
        struct_type = getattr(unreal, struct_name, None)
        if struct_type is None:
            fail(f"missing struct {struct_name}")
        actual_fields = set(struct_type().to_dict().keys())
        if actual_fields != expected_fields:
            fail(f"{struct_name}: expected {expected_fields}, got {actual_fields}")


def verify_rule_assets():
    for path, (team_size, combat, rounds, side_switch) in RULES.items():
        asset = unreal.load_asset(path)
        if asset is None:
            fail(f"missing asset {path}")
        rules = asset.get_editor_property("rules")
        expected = {
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
        for field, value in expected.items():
            actual = rules.get_editor_property(field)
            if isinstance(value, float):
                assert_close(actual, value, f"{path}.{field}")
            elif actual != value:
                fail(f"{path}.{field}: expected {value}, got {actual}")


def verify_difficulty_assets():
    fields = [
        "vision_reaction_seconds",
        "aim_error_degrees",
        "fire_delay_seconds",
        "hearing_radius",
        "search_seconds",
        "tactical_execution_probability",
        "team_assist_probability",
    ]
    for path, values in DIFFICULTIES.items():
        asset = unreal.load_asset(path)
        if asset is None:
            fail(f"missing asset {path}")
        difficulty = asset.get_editor_property("difficulty")
        for field, expected in zip(fields, values):
            assert_close(
                difficulty.get_editor_property(field),
                expected,
                f"{path}.{field}",
            )
        if difficulty.get_editor_property("aim_error_degrees") <= 0.0:
            fail(f"{path}.aim_error_degrees must remain non-zero")


def find_parameter_pins(graph, node_class_name):
    editor = unreal.BlueprintGraphEditor.get_graph_editor(graph)
    pins = {}
    for node in editor.list_all_nodes():
        if node.get_class().get_name() != node_class_name:
            continue
        for pin in unreal.BlueprintEditorLibrary.list_all_pins(node):
            name = str(pin.get_pin_name())
            if name not in {"execute", "then"}:
                pins[name] = pin
    return pins


def verify_pin(pin, expected, label):
    category, type_token = expected
    exported = pin.get_pin_type().export_text()
    if f'PinCategory="{category}"' not in exported:
        fail(f"{label}: expected category {category}, got {exported}")
    if type_token and type_token not in exported:
        fail(f"{label}: expected type containing {type_token}, got {exported}")


def verify_interfaces():
    for path, functions in INTERFACES.items():
        blueprint = unreal.load_asset(path)
        if blueprint is None:
            fail(f"missing asset {path}")
        for function_name, (expected_inputs, expected_outputs) in functions.items():
            graph = unreal.BlueprintEditorLibrary.find_graph(blueprint, function_name)
            if graph is None:
                fail(f"{path}: missing function {function_name}")
            inputs = find_parameter_pins(graph, "K2Node_FunctionEntry")
            outputs = find_parameter_pins(graph, "K2Node_FunctionResult")
            if set(inputs) != set(expected_inputs):
                fail(
                    f"{path}.{function_name} inputs: expected {set(expected_inputs)}, "
                    f"got {set(inputs)}"
                )
            if set(outputs) != set(expected_outputs):
                fail(
                    f"{path}.{function_name} outputs: expected {set(expected_outputs)}, "
                    f"got {set(outputs)}"
                )
            for name, expected in expected_inputs.items():
                verify_pin(inputs[name], expected, f"{path}.{function_name}.{name}")
            for name, expected in expected_outputs.items():
                verify_pin(outputs[name], expected, f"{path}.{function_name}.{name}")


def verify_validator():
    marker = unreal.load_asset("/Game/BLA/Blueprints/Core/BP_BLAGameplayTypes")
    if marker is None:
        fail("missing BP_BLAGameplayTypes")

    validator = unreal.load_asset(VALIDATOR_PATH)
    if validator is None:
        fail("missing BP_BLAGameplayDataValidator")
    parent = unreal.BlueprintEditorLibrary.get_blueprint_parent_class(validator)
    if parent.get_path_name() != "/Script/BLA.BLAGameplayDataValidator":
        fail(f"validator parent is {parent}, expected BLAGameplayDataValidator")

    level_editor = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if not level_editor.load_level(BOOTSTRAP_LEVEL):
        fail(f"could not load {BOOTSTRAP_LEVEL}")
    actor_subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    validator_class = validator.generated_class()
    actors = [
        actor
        for actor in actor_subsystem.get_all_level_actors()
        if actor.get_class() == validator_class
    ]
    if len(actors) != 1:
        fail(f"expected one validator actor in bootstrap map, got {len(actors)}")


def main():
    verify_enums_and_structs()
    verify_rule_assets()
    verify_difficulty_assets()
    verify_interfaces()
    verify_validator()
    unreal.log("BLA_TASK2_CONTRACTS_OK types=9 assets=11 validator_actors=1")


main()
