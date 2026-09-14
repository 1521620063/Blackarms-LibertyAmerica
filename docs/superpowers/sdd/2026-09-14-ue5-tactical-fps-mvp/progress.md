# SDD ledger — plan: docs/superpowers/plans/2026-09-14-ue5-tactical-fps-mvp.md

Resume point: Tasks 1-8 are complete, verified, and pushed (`main` @ `ce36f7b`). Execution resumes at Task 9.

Ruling: implement on `main`, not a worktree — Tasks 1-8 landed on main and every verification path in this project is an absolute-path UE editor run against this checkout; a worktree would duplicate the 60 MB Content tree and invalidate the recorded invocation. Cost if wrong: task commits land on the shared branch and a bad task needs a revert instead of a discarded branch.

Ruling: Task 9 is split into two sequential implementer dispatches (9A objective core + contracts/PIE verification; 9B objective AI tree + functional test) because one dispatch would span native C++ core, editor asset automation, behavior-tree construction, and a scripted functional test. Reviewed as one task. Cost if wrong: an interface seam inside one task that the task review must catch.

Ruling: objective truth lives in `ABLAObjectiveManager` and is mirrored to `ABLAGameState::CurrentObjectiveState`; `ABLADataCore` only owns its physical carry state. This follows the plan's Global Constraint "Core truth stays in GameMode/GameState/PlayerState and managers; UI is read-only". Cost if wrong: a later task that expects to read objective truth from the core actor finds only carry state.

Instruction from the human partner: planning and process artifacts belong in `docs/`, not in scratch directories. This workspace therefore lives at `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/` and is committed with the task it documents.

Ruling: Task 9 does not add a Data Core branch to `ABLAGameModeElimination`. The objective system, its AI, and its functional test are the deliverable; selecting the mode and loading the map belongs to Task 10's player flow and Task 11's map config. Cost if wrong: a human pressing Play on the graybox map in Data Core mode sees inert objective actors until Task 10 wires the flow.

Ruling: the map gets the core, the objective zone, the PlantPoint/DefusePoint tactical points, and `FT_BLA_DataCore`; the functional test spawns its own isolated manager/rules/combatants so its assertions cannot race the level's actors. Cost if wrong: the level's objective actors are unmanaged until Task 10, and the test proves the system rather than the level wiring.

Note: the multi-agent dispatch channel did not deliver task content to a spawned implementer (three attempts; the child reported an empty task each time). Task 9A is therefore implemented directly in this session, and the task review still runs as a separate reviewer pass.

## Preflight conflict scan (Tasks 9-12, checked before dispatch)

| Pair | Producer → Consumer | Finding |
|------|--------------------|---------|
| 9 → 10 | Objective state + actors → HUD objective status, mode select | No conflict. Task 9 must mirror state to `ABLAGameState::CurrentObjectiveState` so Task 10 has a read-only source. |
| 9 → 11 | Objective actors, plant/defuse tactical points → `L_BLA_ZeroFacility` | No conflict. Task 9 wires the existing graybox map only; Task 11 rebuilds the final map and re-places the same actors. |
| 9 → 12 | Outside-map core recovery → `OBJECTIVE_CORE_RESET` diagnostic | Interface dependency: Task 9 must implement reset-outside-valid-area and expose it (manager function + validity check) so Task 12 can add the marker. Recorded for Task 12's dispatch. |
| 10 → 11 | Settings save object, map config asset, GameMode map load | No file overlap: Task 10 owns `WBP_*`/`BP_BLAUIManager`, Task 11 owns `DA_BLAMapConfig_ZeroFacility` and `BP_BLAMapConfig`. |
| 10 → 12 | Test harness drives mode/scale/map selection; HUD refresh assertions | No conflict. |
| 11 → 12 | Navigation test, packaging of the final map | No conflict. |
| 9 self | Files list vs bullets | Files list covers every bullet: objectives (manager/zone/core), objective tree + five tasks, functional test. Bullet "timeout" rides the existing `ABLARoundManager::EvaluateTimeout`; no new file needed. |
| 10 self | Files list vs bullets | Consistent: menus, HUD, results, settings, interaction prompt, command selector all named. |
| 11 self | Files list vs bullets | Consistent: map, map zone, map config asset, navigation test all named. |
| 12 self | Files list vs bullets | Consistent: harness, debug subsystem, two docs, packaging. |
| 9 vs Global Constraints | "Core truth stays in managers; UI read-only"; "no new plugins"; "no broad renames" | Task 9 adds two Blueprintable actor classes + one manager and one editor helper function; it must not restructure Task 5 round rules. |
| 9 vs Task 8 regression | Objective AI must not break `BLA_3V3_ELIMINATION_OK` | Task 9 must re-run the Task 2-8 verification set; a regression there blocks the task. |

No plan defect found that would stop execution. Scan recorded before dispatching Task 9.

## Progress

Task 9: implemented directly in the controller session (delegation unavailable). Evidence: `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/task-9-report.md`.

Task 9: review seat — the collaboration channel did not deliver the review dispatch to a fresh reviewer subagent either (third failed dispatch this turn; the child reported an empty task). A controller self-review of the full task diff was performed instead, recorded here:

- Finding (Important): `ABLAAIController::ResolveObjectiveDirective` issued `MoveToLocation` on every tick while an objective manager was attached — a per-frame path request. Fixed by refreshing the move request only when the destination moves more than 150 units or the pawn is no longer moving (`fix: rate-limit objective ai move requests`).
- Finding (Minor, deferred): `ABLADataCore::SetObjectiveState` is public, so a non-manager system could mirror a state value; completion decisions still live only in `ABLAObjectiveManager` (the contract suite asserts the core exposes no completion API).
- Finding (Minor, deferred): `ResolveObjectiveDirective` keeps the Task 8 `AActor* PlayerActor` parameter for signature symmetry with `ResolveRoleDirective` but does not use it.
- Finding (Minor, deferred): pickup is restricted to attackers even though the plan only mandates attackers-plant / defenders-defuse. Ruling: attackers carry the objective; defenders intercept, investigate, and defuse. Cost if wrong: a future mode that wants defenders to carry needs the constraint relaxed.

Task 9: complete (commits ce36f7b..HEAD, self-reviewed: 1 Important found and fixed, 3 Minor deferred).

## Project rename (human-partner instruction, not a plan task)

The project was renamed to **Blackarms-LibertyAmerica** (黑枪-自由美利坚), tag `BLA`: project file, targets, modules (`BLA`/`BLAEditor`), API macros, C++ type prefixes, content root (`Content/BLA`, `/Game/BLA`), every asset tag, test markers, config, automation scripts, README and docs. Plan: `docs/superpowers/plans/2026-09-14-project-rename-blackarms-liberty-america.md`; evidence and the one hard failure mode are in `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/rename-report.md`.

Ruling: content was **rebuilt from its generators** instead of being moved, because moving assets across a module rename destroys struct/enum-typed property data even with `[CoreRedirects]` present — verified by loading an untouched pre-rename asset with the renamed module (`DA_BLAMatchRules_2v2.team_size` read back as the default 1). Cost if wrong: none observed; all 82 assets are regenerated by `bootstrap_project.py` + `build_task2..9_assets.py`, and the full matrix passes on the rebuilt content.

Ruling: the rename landed on branch `codex/rename-blackarms-liberty-america` and was fast-forwarded to `main` only after the full verification matrix passed. Cost if wrong: an unverified rename would have reached the shared branch.

Ruling: `[CoreRedirects]` (class/struct/enum/package) stay in `Config/DefaultEngine.ini` even though the content is rebuilt, so any older checkout or stale reference still resolves. Cost if wrong: none; they are inert for freshly generated content.

Task 9 remains complete; Task 10 is the next planned task.

## Review pass (2026-09-15, before Task 10)

Full report: `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/review-2026-09-15-code-review.md`.

Ruling: the review landed directly on `main` (same ruling as Tasks 1-9: every verification path is an
absolute-path editor run against this checkout). Cost if wrong: a bad fix needs a revert instead of a
discarded branch.

Fixed in this pass:

1. Objective AI held no position during a timed interaction — the manager's movement cancel restarted
   plant/defuse. Fixed in `BLAAIController` (hold while `Defusing`, `StopMovement` when a plant/defuse starts)
   and covered by the new `ai_defender_defuse_holds_position` assertion (`defuse_hold=1`), proven red-green.
2. Bot aim error was a constant one-sided yaw bias; now a per-shot random error of the same magnitude.
3. Tasks 2-6 PIE drivers could not fail; validators/test actors now expose `bValidationSucceeded` /
   `bValidationFailed` and the drivers assert them (negative probe recorded in the report).
4. `build_task7_assets.py` destroyed every level actor and `build_task8_assets.py` destroyed every spawn and
   tactical point, so re-running them deleted later tasks' content. Both now destroy only their own labelled
   actors; `build_task7_assets.py` was re-run over the accumulated level and all Task 7/8/9 checks still pass.
5. `ABLAObjectiveManager` / `ABLARoundManager` now unbind their delegates in `EndPlay`.
6. `verify_task4_contracts.py` now asserts the full weapon payload; `verify_task9_contracts.py` guards a null
   navigation path.

Tooling: `Scripts/run_verification.ps1` is the committed runner for the 19-check matrix; it enforces the marker
contract, fails fast on contract tracebacks and exits non-zero. `README.md` documents it.

Verification evidence (final tree): `Build.bat` succeeded and `Scripts/run_verification.ps1 -Tag green` reported
`MATRIX_DONE checks=19 failed=0 / MATRIX_OK`.

Deferred to the human or to Task 10 (details and rationale in the report): apply the remaining six bot
difficulty parameters; decide friendly fire; decide whether a dropped core should persist outside the objective
area; repoint `GlobalDefaultGameMode` during Task 10; clean inert delegate `StructRedirects`; delete the dead
`BLA Bootstrap Navigation Bounds` cleanup and the stale pre-rename binaries.

Task 10 remains the next planned task.

## Follow-up pass (2026-09-15, human-partner decisions)

The human partner asked for three follow-ups after the review: put the six bot difficulty parameters to
reasonable use, repoint the default game mode at `BP_BLAGameMode`, and delete the stale pre-rename
artifacts from the local `Binaries`/`Intermediate` trees.

Difficulty parameters are now applied by `ABLAAIController::ApplyDifficulty`:

- `VisionReactionSeconds` gates the first shot after a fresh target acquisition.
- `FireDelaySeconds` throttles AI fire between shots (`IsFireDelayElapsed`); the weapon cooldown is unchanged.
- `HearingRadius` limits hearing stimuli inside `UBLABotPerception::ReportStimulus`; sight and damage are not limited.
- `SearchSeconds` keeps a lost target's last known position alive in `ABLAAIController::UpdateTargetMemory` before the bot forgets it.
- `TacticalExecutionProbability` is the chance an Assault/Defender bot commits to its assigned tactical point; a failed roll falls back to following the team.
- `TeamAssistProbability` is the chance a Support bot assists a teammate instead of holding a point of its own.

Coverage: the Task 6 fixture asserts the hearing-radius cut-off, the reaction gate and the fire-delay gate;
the 3v3 test pins both probabilities to 1.0 for the deterministic role directives and then asserts the 0.0
fallback (Assault/Defender follow the team, Support takes its own point, no bot left without a directive);
Task 6 contracts assert the six fields and `hearing_radius`.

Default game mode: `Config/DefaultEngine.ini` points `GlobalDefaultGameMode` at `BP_BLAGameMode`, and
`build_task5_assets.py` writes the same game mode into the bootstrap map's world settings (the map was copied
from the FirstPerson template and carried the template override). `verify_task5_contracts` asserts
`default_map_game_mode=1`; `verify_bootstrap_pie` asserts PIE runs a `BLAGameMode` with a BLA character pawn;
`verify_task7_pie` asserts the 1v1 map runs `BLAGameModeElimination`.

Local cleanup: deleted the pre-rename `*FPS*` artifacts under `Binaries/` (10 files) and `Intermediate/`
(10 module directories plus the BuildRules files) and the empty `Content/__ExternalActors__/FPS` tree. The next
build regenerated `Binaries/Win64/UnrealEditor.modules` with only `BLA`/`BLAEditor`, and no `*FPS*` artifact
remains under `Binaries`/`Intermediate`.

Runner hardening: matrix entries can now require extra log markers, and the Task 7/8 drivers require
`BLA_1V1_ELIMINATION_OK` and `BLA_3V3_ELIMINATION_OK`. That contract immediately caught a real regression in
this pass: the 3v3 test failed with `reason=support_player_follow` because the probability assertions left the
0.0 difficulty applied for the later automatic re-resolution; fixed by restoring the deterministic difficulty.

Evidence: `Build.bat` succeeded and `Scripts/run_verification.ps1 -Tag final2` reported
`MATRIX_DONE checks=19 failed=0 / MATRIX_OK`.

Standing finding for Task 10/12 (not fixed here): the behavior-tree nodes are still structural shells and no
C++ code drives the live loop - `UpdateTarget`, `AimAndFireAtTarget` and `MoveToTacticalPoint` are only called
by tests, and `AIPerception->OnTargetPerceptionUpdated` is unbound, so a played match currently has passive
bots. The new difficulty gates take effect as soon as that behavior loop is wired.

## AI behavior loop (2026-09-15, requested by the human partner)

The standing finding above is resolved: `ABLAAIController` now drives the live loop in C++ while the behavior
tree stays a structural shell (same convention the objective mode already used).

- `AIPerception->OnTargetPerceptionUpdated` is bound and maps the sense to `EBLA_StimulusType`
  (sight/hearing/damage) before calling `UpdateTarget`, so bots acquire targets on their own.
- `Tick` runs `UpdateTargetMemory` (search/forget with `SearchSeconds`), `UpdateDirectiveFromSources`
  (active team order, else objective directive, else role directive refreshed every 5s), `TickCombat`
  (fires through `AimAndFireAtTarget` and only during the Combat phase) and `TickMovement`
  (rate-limited `MoveToLocation` toward the order/point/follow target, stuck recovery through
  `RecoverFromStuck`); objective movement stays owned by `ResolveObjectiveDirective` so the plant/defuse
  hold rule is preserved.
- `verify_task8_pie.py` now samples the registered bots as soon as they exist and requires at least one of
  them to travel 100+ units, which makes "bots act on their directives" a checked property instead of an
  assumption.

Evidence: `Build.bat` succeeded; `Scripts/run_verification.ps1 -Tag loop` reported
`MATRIX_DONE checks=19 failed=0 / MATRIX_OK` with `moved=1026.9 / 1188.1 / 1080.4` for team sizes 1/2/3.
