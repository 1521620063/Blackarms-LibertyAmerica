# Code review — 2026-09-15 (Tasks 1-9 + rename, before Task 10)

## How the review ran

- The controller reviewed the runtime gameplay C++ (`Source/BLA`) directly.
- A reviewer subagent reviewed the tooling (`Scripts/Editor`, `Source/BLAEditor`, `Config`) with a precise
  brief. Process note: its dispatch payload arrived empty (the defect `progress.md` already records three
  times); the reviewer recovered the brief from the session transcript, and `git status` stayed clean.
- Both passes are backed by a full re-run of the dynamic matrix on the final tree.

## Defects found and fixed

1. **Objective AI restarted its own interactions** — `ABLAAIController::ResolveObjectiveDirective` re-issued
   `MoveToLocation` while a plant/defuse was running; the objective manager cancels a timed interaction when
   the interactor moves more than the movement tolerance, so the bot walked and the timer repeatedly reset.
   Fixed by holding position while `Defusing` and calling `StopMovement()` when a plant or defuse starts.
   Regression assertion added to `ABLADataCoreTest` (`ai_defender_defuse_holds_position`, marker
   `defuse_hold=1`); red-green evidence below.
2. **Bot aim error was a systematic bias** — the difficulty's `AimErrorDegrees` was applied as a constant
   positive yaw offset, so every bot missed to the same side by a fixed angle that exceeds a body width at
   normal engagement range. Fixed to a per-shot random yaw inside `[-error, +error]`; magnitude (and therefore
   the "Hard keeps non-zero error" rule) is unchanged.
3. **PIE drivers for Tasks 2-6 could not fail** — they ran PIE for N ticks and logged `OK` without reading the
   in-level validator, so a missing or failing validator still produced a green marker. Fixed by exposing
   `bValidationSucceeded` / `bValidationFailed` (`BlueprintReadOnly`) on the five validators/test actors and
   rewriting each driver to assert them with a timeout.
4. **Generators were order-dependent and destructive** — `build_task7_assets.py` destroyed *every* actor in
   the level (deleting Task 8/9 content on a re-run), and `build_task8_assets.py` destroyed every spawn point
   and tactical point (deleting Task 9's objective points). Fixed: each generator now destroys only actors it
   owns, by label.
5. **Manager teardown leaked delegate bindings** — `ABLAObjectiveManager` (team-manager death multicast and
   interactor health delegates) and `ABLARoundManager` (team-manager death multicast) now unbind in `EndPlay`.
6. **Verifier gaps** — `verify_task4_contracts.py` asserted 3 of 11 weapon fields; it now asserts the full
   payload (damage, RPM, reserve ammo, reload, range, falloff, spread, AI preferred range) with float
   tolerance. `verify_task9_contracts.py` guards the navigation path lookup instead of raising `AttributeError`.

## Verification (final tree)

```
Build.bat BlackarmsLibertyAmericaEditor Win64 Development -> Result: Succeeded
Scripts/run_verification.ps1 -Tag green                  -> MATRIX_DONE checks=19 failed=0 / MATRIX_OK
```

Markers observed in `Saved/Logs/V_*_green.log`:

```
BLA_TASK2_CONTRACTS_OK types=9 assets=11 validator_actors=1
BLA_TASK3_CONTRACTS_OK native=7 blueprints=7 actions=8 mappings=11
BLA_TASK4_CONTRACTS_OK native=6 blueprints=8 data_assets=3
BLA_TASK5_CONTRACTS_OK native=8 blueprints=8
BLA_TASK6_CONTRACTS_OK native=5 blueprints=12 blackboard_keys=9 behavior_trees=1
BLA_TASK7_CONTRACTS_OK map=1 room=1 protected_spawns=2 cover=3 navmesh=1 game_modes=1 functional_tests=1
BLA_TASK8_CONTRACTS_OK native=3 orders=4 team_sizes=3 roles=3 commands=4 spectator=1 assets=7 spawns=6 tactical_points=3
BLA_TASK9_CONTRACTS_OK native=4 blueprints=4 states=10 manager_functions=8 core_completion_api=0 core=1 zone=1 tactical=2 functional_tests=1 map_preserved=1 objective_tasks=5 behavior_trees=1
BLA_PIE_VERIFY_OK pawn=BLAPlayerCharacter_3 moved=449.96
BLA_TASK2_PIE_DRIVER_OK ticks=1 validator=ok label=BLA Gameplay Data Validator
BLA_TASK3_PIE_DRIVER_OK ticks=40 validator=ok label=BLA Character Foundation Validator
BLA_TASK4_PIE_DRIVER_OK ticks=3 validator=ok label=BLA Weapon Test Actor
BLA_TASK5_PIE_DRIVER_OK ticks=4 validator=ok label=BLA Round Test Actor
BLA_TASK6_PIE_DRIVER_OK ticks=1 validator=ok label=BLA AI Test Fixture
BLA_TASK7_PIE_DRIVER_OK ticks=240
BLA_TASK8_PIE_DRIVER_OK ticks=300 team_size=1 registration=2 duplicates=0
BLA_TASK8_PIE_DRIVER_OK ticks=300 team_size=2 registration=4 duplicates=0
BLA_TASK8_PIE_DRIVER_OK ticks=300 team_size=3 registration=6 duplicates=0
BLA_TASK9_PIE_DRIVER_OK ticks=300 datacore=ok
```

Supporting evidence:

- Generator order-independence: `build_task7_assets.py` re-ran over the accumulated level and logged
  `BLA_TASK7_ASSETS_BUILT`; the Task 8 and Task 9 contract checks and PIE drivers still pass afterwards
  (`spawns=6 tactical_points=3`, `core=1 zone=1 tactical=2`). Task 7 re-saved the level and the two Task 7
  blueprints, so those three generated assets are part of this commit.
- Driver red-green: with the defuse-hold fix removed the Data Core driver failed with
  `BLA_TASK9_PIE_DRIVER_FAILED data core test failed reason=ai_defender_defuse_holds_position` and the runner
  exited non-zero (`MATRIX_FAILED`); with the fix restored the same check passes and its marker carries
  `defuse_hold=1`.
- Negative probe: a copy of the Task 2 driver pointed at a validator class absent from the map logged
  `BLA_PROBE_PIE_DRIVER_FAILED validator_incomplete count=0`, proving the new assertion is not vacuous.

## Findings reviewed and deliberately not changed

| # | Finding | Why it was left alone | Recommendation |
|---|---------|----------------------|----------------|
| 1 | Only `AimErrorDegrees` of the seven `FBLABotDifficulty` fields is used at runtime; `VisionReactionSeconds`, `FireDelaySeconds`, `HearingRadius`, `SearchSeconds`, `TacticalExecutionProbability`, `TeamAssistProbability` are set and validated but never applied. | The Task 6 fixture asserts an immediate shot, so applying a reaction delay changes the task's own functional test — that is task-sized work, not a review fix. | Add "apply all difficulty parameters" to Task 10 (difficulty is selected there) or as its own task. |
| 2 | Damage resolution has no team check: the player can damage teammates (bots never deliberately target friendlies). | Nothing in the plan or spec states friendly-fire policy; changing it silently would change gameplay semantics. | Human decision; if off, gate `ABLADamageResolver::ResolveDamage` on instigator/target team. |
| 3 | A dropped core is teleported home whenever it is outside the plant zone and more than 150 units from home, so "dropped in the open" states are short-lived and the AI's `Investigate`/`InterceptCarrier` tasks rarely fire. | Matches the plan bullet ("drop on carrier death and reset outside valid area") and the verified `recovery=outside_area` contract. | Human decision; if the drop should persist, widen the valid area to the playable map (a recovery volume/`KillZ` check). |
| 4 | `GlobalDefaultGameMode` is still `/Game/FirstPerson/Blueprints/BP_FirstPersonGameMode` while `GameDefaultMap` is the BLA bootstrap map. The 1v1 map overrides its game mode in world settings, so the matrix passes. | The reviewer's recommendation is to repoint it together with Task 10's entry flow; the bootstrap map currently produces a `BLAPlayerCharacter` pawn in PIE. | Task 10: point the default game mode at `BP_BLAGameMode`/`BP_BLAGameMode_Elimination`. |
| 5 | Ten `+StructRedirects=` lines target dynamic delegate signatures, which are `UFunction` objects, not structs (two of them are plain C++ typedefs). | Inert but harmless: content is regenerated, so nothing depends on them. | Optional cleanup (`FunctionRedirects` with `__DelegateSignature` names, or delete). |
| 6 | `build_task6_assets.py` destroys any `NavMeshBoundsVolume` labelled "BLA Bootstrap Navigation Bounds", a label no script creates. | Dead cleanup; it changes nothing today, and removing it is a judgement call about hand-placed actors. | Delete the block or have the script create the bounds it expects. |
| 7 | `bootstrap_project.py` does not create the ownership folders the plan allows (`Data/Maps`, `Data/UI`, `Maps/Final`). | Unreal creates directories on save; nothing fails today. | Confirm during Task 10/11 asset creation. |
| 8 | Stale pre-rename binaries remain in the local, gitignored `Binaries/`/`Intermediate/` trees, and `Binaries/Win64/UnrealEditor.modules` still lists `FPS`/`FPSEditor` next to `BLA`/`BLAEditor`. | Gitignored local state; the environment blocked shell deletion, and the editor loads `BLA`/`BLAEditor` correctly in every matrix run. | Delete the `*FPS*` artifacts and let a clean build regenerate the manifest. |

## Tooling added

`Scripts/run_verification.ps1` runs the whole matrix (19 checks), enforces the marker contract (a run must
emit its `BLA_*_OK` marker; `_FAILED`, missing markers, timeouts and contract tracebacks fail fast), refuses to
overlap editor instances, and exits non-zero on any failure. `README.md` documents it.

## Follow-up pass (2026-09-15, requested by the human partner)

Three deferred items from the table above were actioned:

1. **Difficulty parameters (item 1)** - all six are now applied: `VisionReactionSeconds` gates the first shot
   after a fresh acquisition, `FireDelaySeconds` throttles AI fire, `HearingRadius` limits hearing stimuli,
   `SearchSeconds` bounds how long a lost target is remembered, `TacticalExecutionProbability` gates the
   Assault/Defender point commitment (falling back to team-follow) and `TeamAssistProbability` decides whether a
   Support bot assists a teammate or holds its own point. Asserted by the Task 6 fixture (hearing cut-off,
   reaction gate, fire-delay gate) and the 3v3 test (deterministic 1.0 role directives plus 0.0
   fallback/no-idle assertions).
2. **Default game mode (item 4)** - `GlobalDefaultGameMode` and the bootstrap map's world settings now point at
   `BP_BLAGameMode`; `verify_task5_contracts` asserts the map binding, `verify_bootstrap_pie` asserts PIE runs a
   `BLAGameMode` with a BLA pawn, and `verify_task7_pie` asserts the 1v1 map runs `BLAGameModeElimination`.
3. **Stale binaries (item 8)** - the pre-rename `*FPS*` artifacts under `Binaries/`/`Intermediate/` and the
   empty `Content/__ExternalActors__/FPS` tree were deleted; the rebuilt manifest lists only `BLA`/`BLAEditor`.

The runner also grew a required-marker contract (the Task 7/8 drivers must see `BLA_1V1_ELIMINATION_OK` and
`BLA_3V3_ELIMINATION_OK`). It paid off immediately: the 3v3 test failed with `reason=support_player_follow`
because the probability assertions left the 0.0 difficulty applied, and the driver reported
`FAILED missing_markers BLA_3V3_ELIMINATION_OK` instead of a silent pass. Fixed by restoring the deterministic
difficulty after the probability assertions.

Final evidence for this pass: `Build.bat` succeeded; `Scripts/run_verification.ps1 -Tag final2` reported
`MATRIX_DONE checks=19 failed=0 / MATRIX_OK`.

New standing finding (recorded in the ledger, not fixed): the behavior-tree nodes remain structural shells and
nothing in C++ drives the live loop (`UpdateTarget`, `AimAndFireAtTarget`, `MoveToTacticalPoint` are only called
by tests; `OnTargetPerceptionUpdated` is unbound), so a played match has passive bots until the behavior loop is
wired in Task 10/12.
