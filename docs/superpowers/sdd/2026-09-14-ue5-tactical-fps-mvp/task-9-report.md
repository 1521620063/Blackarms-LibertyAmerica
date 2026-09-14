# Task 9 report — Data Core Attack/Defense

## What was built

Native runtime (`Source/FPS`):

- `AFPSDataCore` (`FPSDataCore.h/.cpp`) — physical core actor: carry state, attach/detach, drop on carrier death, reset to home. Exposes no completion API.
- `AFPSObjectiveZone` (`FPSObjectiveZone.h/.cpp`) — spatial plant/upload volume with `ContainsActor` / `ContainsLocation`.
- `AFPSObjectiveManager` (`FPSObjectiveManager.h/.cpp`) — the only objective authority: pickup/plant/defuse interactions, the interaction and upload timers, cancellation, round-transition reset, outside-area core recovery, and `RoundManager.EndRound` routing with explicit reasons.
- `AFPSDataCoreTest` (`FPSDataCoreTest.h/.cpp`) — functional test actor covering the full state machine plus AI directives.
- `AFPSRoundManager::GetActiveRules()` — additive accessor so objective timings come from the active `FFPSMatchRules` instead of duplicated literals.
- `AFPSAIController::ConfigureObjective` / `ResolveObjectiveDirective` plus `bHasObjectiveDirective` / `CurrentObjectiveTask`; the controller resolves the objective directive from `Tick` when an objective manager is attached.

Editor-only (`Source/FPSEditor`):

- `UFPSBlueprintAssetBuilder::ConfigureFPSBotObjectiveBehaviorTree` — builds the objective tree (combat branch + five-task objective selector) mirroring the Task 8 team-tree helper.

Assets and automation:

- `BP_FPSDataCore`, `BP_FPSObjectiveZone`, `BP_FPSObjectiveManager` in `Content/FPS/Blueprints/Objectives`.
- `BTT_FPSSeekDataCore`, `BTT_FPSCarryDataCore`, `BTT_FPSPlantDataCore`, `BTT_FPSDefendObjective`, `BTT_FPSDefuseDataCore` and `BT_FPSBotObjective` (blackboard `BB_FPSBot`).
- `FT_FPS_DataCore` placed in `L_FPS_1v1_Elimination` together with `Data Core`, `Data Core Objective Zone`, `Data Core Plant Point`, `Data Core Defuse Point`.
- `Scripts/Editor/build_task9_assets.py`, `verify_task9_contracts.py`, `verify_task9_pie.py`.

## Commands run and raw markers

```text
Build.bat FPSEditor Win64 Development  -> Result: Succeeded
build_task9_assets.py                  -> FPS_TASK9_ASSETS_BUILT objectives=3 functional_tests=1 tactical_points=2 core=1 zone=1 objective_tasks=5 behavior_trees=1
verify_task9_contracts.py              -> FPS_TASK9_CONTRACTS_OK native=4 blueprints=4 states=10 manager_functions=8 core_completion_api=0 core=1 zone=1 tactical=2 functional_tests=1 map_preserved=1 objective_tasks=5 behavior_trees=1
verify_task9_pie.py                    -> FPS_DATACORE_OK pickup=attacker_only drop=carrier_death repickup=1 plant_interrupt=movement_zone_damage plant=1 defuse_interrupt=zone_damage defuse=1 upload=1 timeout=1 elimination=1 reset=idempotent recovery=outside_area authority=manager
                                       -> FPS_TASK9_PIE_DRIVER_OK ticks=300 datacore=ok
```

Regression (all re-run after the final code change):

```text
FPS_TASK2_CONTRACTS_OK  FPS_TASK3_CONTRACTS_OK  FPS_TASK4_CONTRACTS_OK  FPS_TASK5_CONTRACTS_OK
FPS_TASK6_CONTRACTS_OK  FPS_TASK7_CONTRACTS_OK  FPS_TASK8_CONTRACTS_OK
FPS_PIE_VERIFY_OK       FPS_TASK7_PIE_DRIVER_OK
FPS_TASK8_PIE_DRIVER_OK team_size=1 / team_size=2 / team_size=3
```

Log files: `Saved/Logs/Task9AssetBuild3.log`, `Task9Contracts2.log`, `Task9PIE5.log`, `Regress3_*.log`, `Regress3_task8_pie_{1,2,3}.log`.

## Defects found and fixed during the task

1. `DetachFromActor` takes `FDetachmentTransformRules`, not `FAttachmentTransformRules` — compile error, fixed.
2. `AFPSObjectiveManager::Tick` originally returned early when no interactor was active, so a completed plant never advanced to `Uploading` and the upload timer never ran — fixed by advancing `Planted`/`Uploading` independent of the active interactor (`FPS_DATACORE_FAILED reason=uploading_state`).
3. Python property names for `b`-prefixed booleans are `is_objective_point`, `test_failed`, `test_succeeded` (not `b_*`) — build and PIE driver fixed.
4. The test's first carry assertion failed because the picking-up bot was still standing inside the objective zone, so the directive correctly went straight to `Plant` — the test now moves the carrier out of the zone before asserting `CarryToPlant`.

## Known seams (deliberate, recorded in the ledger)

- `AFPSGameModeElimination` does not yet branch on `EFPS_MatchMode::DataCoreAttackDefense`; the level's objective actors are placed and verified but are driven by the functional test until Task 10 wires mode selection and Task 11 wires the map config.
- Blueprint behavior-tree task nodes remain structural shells (same convention as Tasks 6 and 8); the objective decisions are implemented in `AFPSAIController::ResolveObjectiveDirective`.

## Not verified

- Human-played PIE session (all evidence above is automated headless PIE plus editor script runs).
