# SDD ledger — plan: docs/superpowers/plans/2026-09-14-ue5-tactical-fps-mvp.md

Resume point: Tasks 1-8 are complete, verified, and pushed (`main` @ `ce36f7b`). Execution resumes at Task 9.

Ruling: implement on `main`, not a worktree — Tasks 1-8 landed on main and every verification path in this project is an absolute-path UE editor run against this checkout; a worktree would duplicate the 60 MB Content tree and invalidate the recorded invocation. Cost if wrong: task commits land on the shared branch and a bad task needs a revert instead of a discarded branch.

Ruling: Task 9 is split into two sequential implementer dispatches (9A objective core + contracts/PIE verification; 9B objective AI tree + functional test) because one dispatch would span native C++ core, editor asset automation, behavior-tree construction, and a scripted functional test. Reviewed as one task. Cost if wrong: an interface seam inside one task that the task review must catch.

Ruling: objective truth lives in `AFPSObjectiveManager` and is mirrored to `AFPSGameState::CurrentObjectiveState`; `AFPSDataCore` only owns its physical carry state. This follows the plan's Global Constraint "Core truth stays in GameMode/GameState/PlayerState and managers; UI is read-only". Cost if wrong: a later task that expects to read objective truth from the core actor finds only carry state.

Instruction from the human partner: planning and process artifacts belong in `docs/`, not in scratch directories. This workspace therefore lives at `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/` and is committed with the task it documents.

Ruling: Task 9 does not add a Data Core branch to `AFPSGameModeElimination`. The objective system, its AI, and its functional test are the deliverable; selecting the mode and loading the map belongs to Task 10's player flow and Task 11's map config. Cost if wrong: a human pressing Play on the graybox map in Data Core mode sees inert objective actors until Task 10 wires the flow.

Ruling: the map gets the core, the objective zone, the PlantPoint/DefusePoint tactical points, and `FT_FPS_DataCore`; the functional test spawns its own isolated manager/rules/combatants so its assertions cannot race the level's actors. Cost if wrong: the level's objective actors are unmanaged until Task 10, and the test proves the system rather than the level wiring.

Note: the multi-agent dispatch channel did not deliver task content to a spawned implementer (three attempts; the child reported an empty task each time). Task 9A is therefore implemented directly in this session, and the task review still runs as a separate reviewer pass.

## Preflight conflict scan (Tasks 9-12, checked before dispatch)

| Pair | Producer → Consumer | Finding |
|------|--------------------|---------|
| 9 → 10 | Objective state + actors → HUD objective status, mode select | No conflict. Task 9 must mirror state to `AFPSGameState::CurrentObjectiveState` so Task 10 has a read-only source. |
| 9 → 11 | Objective actors, plant/defuse tactical points → `L_FPS_ZeroFacility` | No conflict. Task 9 wires the existing graybox map only; Task 11 rebuilds the final map and re-places the same actors. |
| 9 → 12 | Outside-map core recovery → `OBJECTIVE_CORE_RESET` diagnostic | Interface dependency: Task 9 must implement reset-outside-valid-area and expose it (manager function + validity check) so Task 12 can add the marker. Recorded for Task 12's dispatch. |
| 10 → 11 | Settings save object, map config asset, GameMode map load | No file overlap: Task 10 owns `WBP_*`/`BP_FPSUIManager`, Task 11 owns `DA_FPSMapConfig_ZeroFacility` and `BP_FPSMapConfig`. |
| 10 → 12 | Test harness drives mode/scale/map selection; HUD refresh assertions | No conflict. |
| 11 → 12 | Navigation test, packaging of the final map | No conflict. |
| 9 self | Files list vs bullets | Files list covers every bullet: objectives (manager/zone/core), objective tree + five tasks, functional test. Bullet "timeout" rides the existing `AFPSRoundManager::EvaluateTimeout`; no new file needed. |
| 10 self | Files list vs bullets | Consistent: menus, HUD, results, settings, interaction prompt, command selector all named. |
| 11 self | Files list vs bullets | Consistent: map, map zone, map config asset, navigation test all named. |
| 12 self | Files list vs bullets | Consistent: harness, debug subsystem, two docs, packaging. |
| 9 vs Global Constraints | "Core truth stays in managers; UI read-only"; "no new plugins"; "no broad renames" | Task 9 adds two Blueprintable actor classes + one manager and one editor helper function; it must not restructure Task 5 round rules. |
| 9 vs Task 8 regression | Objective AI must not break `FPS_3V3_ELIMINATION_OK` | Task 9 must re-run the Task 2-8 verification set; a regression there blocks the task. |

No plan defect found that would stop execution. Scan recorded before dispatching Task 9.

## Progress

Task 9: implemented directly in the controller session (delegation unavailable). Evidence: `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/task-9-report.md`.
