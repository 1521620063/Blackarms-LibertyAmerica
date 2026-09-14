# Task 9 brief — Implement Data Core Attack/Defense

Plan: `docs/superpowers/plans/2026-09-14-ue5-tactical-fps-mvp.md` (Task 9). This brief is the single source of requirements. The plan text is reproduced verbatim below; the sections after it are the interfaces and conventions this brief adds.

## Plan text (verbatim)

### Task 9: Implement Data Core Attack/Defense

**Files:** Create `BP_FPSDataCore`, `BP_FPSObjectiveZone`, `BP_FPSObjectiveManager`, `BTT_FPSSeekDataCore`, `BTT_FPSCarryDataCore`, `BTT_FPSPlantDataCore`, `BTT_FPSDefendObjective`, `BTT_FPSDefuseDataCore`, `BT_FPSBotObjective`, `FT_FPS_DataCore`.

**Interfaces:** Consumes round, team, interaction, perception, and tactical systems; produces objective mode without duplicating round rules.

- [ ] Implement objective states `Available`, `Carried`, `Dropped`, `Planting`, `Planted`, `Uploading`, `Defusing`, `Defused`, and `Completed`; drop on carrier death and reset outside valid area.
- [ ] Allow attackers to plant and defenders to defuse only after plant; use 5 seconds for plant/defuse and 30 seconds for upload.
- [ ] Cancel interaction on movement, damage, death, leaving zone, or round transition; only ObjectiveManager may complete the objective.
- [ ] Route elimination, timeout, defuse, and upload wins through `RoundManager.EndRound` with explicit reasons.
- [ ] Build objective tree: attackers seek/carry/plant/defend; defenders guard/intercept/investigate/defuse.
- [ ] Test pickup, drop, repickup, plant interruption, plant, defuse interruption, defuse, upload, timeout, and reset.
- [ ] Commit `feat: add data core attack and defense mode`.

## Global constraints that bind this task

- Windows PC, offline AI vs player; no networking work.
- Core truth stays in GameMode/GameState/PlayerState and managers. UI (and the core actor) are not rule authorities.
- Use Data Assets/Data Tables for rules; plant/defuse/upload seconds come from `FFPSMatchRules` (`PlantSeconds`, `DefuseSeconds`, `UploadSeconds`), never from hardcoded literals in Blueprint assets.
- Do not add plugins, do not rename existing assets, do not refactor unrelated systems, keep Level Blueprint empty except editor-only diagnostics already approved.
- Every task ends with an editor/PIE or automated test cycle; do not claim completion from editor appearance.
- Hitscan only, no projectiles.

## Required interfaces (design decided by the controller — implement exactly, extend only if a test forces it)

Native C++ classes (this project authors gameplay logic in C++ and exposes Blueprint subclasses; follow the Task 5-8 pattern):

| Native class | Blueprint asset | Responsibility |
|--------------|-----------------|----------------|
| `AFPSDataCore` | `/Game/FPS/Blueprints/Objectives/BP_FPSDataCore` | Physical core actor: `State`, `Carrier`, `HomeLocation`; `CanBePickedUp()`, `GiveTo(AActor*)`, `RemoveFromCarrier()`, `ResetToHome()`, `IsCarriedBy(AActor*)`. Attaches to the carrier when carried, detaches and drops on death. Owns no match rules. |
| `AFPSObjectiveZone` | `/Game/FPS/Blueprints/Objectives/BP_FPSObjectiveZone` | Plant/upload volume: `ZoneExtent`, `ContainsActor(const AActor*)`, `IsInsideZone(const FVector&)`. |
| `AFPSObjectiveManager` | `/Game/FPS/Blueprints/Objectives/BP_FPSObjectiveManager` | The only authority that starts, cancels, or completes an objective action. Owns the interaction timer and routes every terminal outcome through `AFPSRoundManager::EndRound`. |

`AFPSObjectiveManager` contract (minimum):

```text
Configure(AFPSGameState*, AFPSRoundManager*, AFPSDataCore*, AFPSObjectiveZone*, AFPSTeamManager*)
BeginPickup(AFPSCharacterBase* Interactor) -> bool          // Available/Dropped + attacker + in range
BeginPlant(AFPSCharacterBase* Interactor) -> bool           // attacker carrying core, inside zone
BeginDefuse(AFPSCharacterBase* Interactor) -> bool          // defender, state Planted/Uploading only
CancelInteraction(AActor* Interactor, FName Reason)         // movement/damage/death/zone exit/round transition
HandleCarrierDeath(AFPSCharacterBase* Carrier)              // drop at carrier location
ResetObjective()                                            // idempotent round reset
IsObjectiveInValidArea() const -> bool
ObjectiveState (mirrored to AFPSGameState::CurrentObjectiveState)
ActiveInteractor, InteractionRemaining, LastCancelReason    (read-only observability for tests/UI)
```

Rules:

- Plant 5 s / defuse 5 s / upload 30 s, read from `FFPSMatchRules`; upload only ever follows a completed plant. Attackers plant, defenders defuse, defuse is rejected before a plant.
- Cancel on any of: interactor movement beyond a small tolerance, interactor taking damage, interactor death, interactor leaving the zone (plant/defuse), and round transition (`Preparation`/`RoundResult`/`MatchResult`).
- Terminal routing: `EndRound(Attackers, "ObjectiveUploaded")` on upload completion, `EndRound(Defenders, "ObjectiveDefused")` on defuse completion. Elimination (`"Elimination"`) and timeout (`"TimeoutLivingCount"`/`"TimeoutHealth"`/`"OvertimeDraw"`) already exist in `AFPSRoundManager` and must keep working unchanged.
- `ResetObjective()` is idempotent and is driven by round start/next-round, so two resets in a row leave identical state.
- Core dropped outside the valid area is returned to its home location by the manager; expose the condition so Task 12 can log `OBJECTIVE_CORE_RESET`.

AI (Task 9 bullet 5):

- `AFPSAIController` gains objective awareness (`ResolveObjectiveDirective(...)` or an equivalent), used only in Data Core mode: attackers seek the core, carry it to the plant point, plant, then hold; defenders guard the objective, intercept the carrier, investigate the last known core location, and defuse once planted.
- Blueprint shell tasks (parent `/Script/AIModule.BTTask_BlueprintBase`, created exactly like Task 8's `BTT_FPS*`): `/Game/FPS/AI/Tasks/BTT_FPSSeekDataCore`, `BTT_FPSCarryDataCore`, `BTT_FPSPlantDataCore`, `BTT_FPSDefendObjective`, `BTT_FPSDefuseDataCore`.
- Behavior tree `/Game/FPS/AI/BehaviorTrees/BT_FPSBotObjective` built through a new editor-only helper on `UFPSBlueprintAssetBuilder` (mirror `ConfigureFPSBotTeamBehaviorTree`), with blackboard keys reused from `BB_FPSBot` where possible; keep `BT_FPSBotElimination` untouched and working.

Functional test:

- Native `AFPSDataCoreTest` (Blueprint `/Game/FPS/Tests/FT_FPS_DataCore`, placed in `L_FPS_1v1_Elimination` by the asset builder) that asserts, in one PIE run: pickup, drop on carrier death, repickup, plant interruption (movement and damage), successful plant, defuse interruption, successful defuse, upload completion, timeout routing, and idempotent reset. It logs exactly one of `FPS_DATACORE_OK detail...` or `FPS_DATACORE_FAILED reason=<token>`, mirroring `FPS3v3EliminationTest`.
- Elimination must still win rounds in Data Core mode and timeout must still resolve; assert both through `AFPSRoundManager`.

## Repository conventions you must follow

- Native code: `Source/FPS/Public/FPS*.h`, `Source/FPS/Private/FPS*.cpp`, `FPS_API` class macro, `GENERATED_BODY()`, Blueprintable, `UFUNCTION(BlueprintCallable)` for test-visible functions. Editor-only helpers go in `Source/FPSEditor/Public|Private/FPSBlueprintAssetBuilder.*`.
- Asset creation is scripted, never manual: `Scripts/Editor/build_task9_assets.py` follows `build_task8_assets.py` (create-or-load blueprint, compile, save, then rebuild map actors idempotently). Verification: `Scripts/Editor/verify_task9_contracts.py` (asset/native-type/contract assertions, exits non-zero on failure) and `Scripts/Editor/verify_task9_pie.py` (starts PIE, drives the run, logs `FPS_TASK9_PIE_DRIVER_OK`/`_FAILED`).
- Editor invocation (exact, copy it):

```text
"D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "D:\dev\Blackarms-LibertyAmerica\FPS.uproject" -unattended -nop4 -nosplash -nullrhi -NoSound -ExecCmds="py D:/dev/Blackarms-LibertyAmerica/Scripts/Editor/<script>.py" -abslog="D:\dev\Blackarms-LibertyAmerica\Saved\Logs\<name>.log"
```

- Map edits stay additive to `L_FPS_1v1_Elimination`; keep the Task 7/8 actors (spawn points, cover, navmesh, test actors, spectator camera) working, and destroy-then-recreate only the actors this task owns so the script is re-runnable.
- The Task 2-8 contract suites and the Task 8 PIE runs must still pass after this task.

## Evidence the task must produce before it may commit

1. `verify_task9_contracts.py` run log ending in `FPS_TASK9_CONTRACTS_OK`.
2. `verify_task9_pie.py` run log ending in `FPS_TASK9_PIE_DRIVER_OK`, containing `FPS_DATACORE_OK`.
3. Regression logs: Task 2-8 contract scripts still pass, and the Task 7 + Task 8 PIE runs still log `FPS_1V1_ELIMINATION_OK` and `FPS_3V3_ELIMINATION_OK`.
4. One commit, message exactly `feat: add data core attack and defense mode`.

If a native build or editor run fails, fix it and re-run; report the failing log path if you cannot.
