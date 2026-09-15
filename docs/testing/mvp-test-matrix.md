# BLA MVP test matrix

Everything in this document runs headless through `UnrealEditor-Cmd.exe` (UE 5.8.2) against this checkout.
One editor process at a time: a second instance silently loses the project lock and produces an empty log.

## One-shot regression run

```powershell
pwsh -File Scripts/run_verification.ps1            # 25 checks, exits non-zero on any failure
pwsh -File Scripts/run_verification.ps1 -Only verify_task11_pie -Tag myrun
```

Each entry must emit its `BLA_*_OK` marker in `Saved/Logs/V_<check>_<tag>.log`. A `_FAILED` marker, a missing
marker, a contract traceback (`TASK*_CONTRACT_FAILURE`) or a timeout fails the run. Entries can also require
extra markers from the same log (for example the Task 11 driver requires `BLA_MAP_NAVIGATION_OK` and
`BLA_ELIMINATION_MATCH_READY`).

## Content generators

Run in order on a clean checkout: `bootstrap_project.py` → `build_task2_assets.py` … `build_task12_assets.py`.
Every generator destroys only the actors it owns, so a single generator can be re-run without deleting another
task's level content.

| Script | Purpose |
|--------|---------|
| `bootstrap_project.py` | copies the FirstPerson template into `/Game/BLA/Maps/Graybox/L_TestBootstrap` |
| `build_task2..6_assets.py` | gameplay data contracts, character foundation, weapons, rounds, AI/perception assets on the bootstrap map |
| `build_task7_assets.py` | 1v1 elimination graybox arena + elimination game mode + navigation bounds |
| `build_task8_assets.py` | 3v3 spawns, tactical points, spectator camera, elimination behavior tree |
| `build_task9_assets.py` | Data Core objective set, objective behavior tree, objective functional test |
| `build_task10_assets.py` | UI widget Blueprints, `BP_BLAUIManager`, UI flow test on both maps |
| `build_task11_assets.py` | Zero Facility map, map config asset, navigation test |
| `build_task12_assets.py` | test harness on the menu map, all-flows test on the Zero Facility map |

## Matrix

| # | Check | Proves |
|---|-------|--------|
| 1-8 | `verify_task2..9_contracts` | every type, data asset, Blueprint parent, blackboard key, behavior tree, map actor and API the plan lists exists (including the level objective manager, the six difficulty fields and the full weapon payload) |
| 9 | `verify_task10_contracts` | 11 widget Blueprints, the UI manager wiring, the HUD/settings field sets, the GameInstance selection/travel/settings API, both flow-test placements |
| 10 | `verify_task11_contracts` | Zero Facility zones (8), spawns (3 per team), all seven tactical point types, cover, map config asset + actor, level objective manager, navmesh bounds, default game mode |
| 11 | `verify_task12_contracts` | debug subsystem API, harness + all-flows Blueprints, harness placement/target map, round watchdog field |
| 12 | `verify_bootstrap_pie` | the default map runs a BLA game mode with a BLA pawn that moves |
| 13-19 | `verify_task2..6_pie` | the in-level validators pass in PIE; the drivers assert the validator flags instead of trusting the run |
| 20 | `verify_task7_pie` | the 1v1 map runs `BLAGameModeElimination` (plus the 1v1/3v3 functional-test markers) |
| 21-23 | `verify_task8_pie` (SIZE=1/2/3) | team population, no duplicate registration and real bot travel for Solo, 2v2 and 3v3 |
| 24 | `verify_task9_pie` | the Data Core functional test passes (`defuse_hold`, recovery, authority assertions) |
| 25 | `verify_task10_pie` | menu selections + settings round-trip, real travel to the match map, HUD read-back, round result, match result, restart and the return-to-menu request |
| 26 | `verify_task11_pie` | the Zero Facility navigation test passes and bots act on the new map |
| 27 | `verify_task12_pie` | the harness selects mode/scale/difficulty, starts a real match, the all-flows test runs (HUD read-back, forced damage, forced objective action, results, restart) and the result comes back through the menu |

Counts in the table correspond to the number of editor invocations, not the number of `-Only` names; the runner
reports `checks=<n>` for the exact number of the run.

## Longer runs

| Command | Purpose |
|---------|---------|
| `BLA_TASK11_SOAK_MODE=data_core BLA_TASK11_SOAK_SIZE=3 py verify_task11_soak.py` | five matches for one mode/scale pair on the Zero Facility map; logs `BLA_TASK11_SOAK_MATCH`/`_OK` with first contact, travel, stuck ticks, routes and objective states (see `README.md` for the 2026-09-15 results) |
| `BLA_TASK12_MODE=elimination BLA_TASK12_SIZE=2 BLA_TASK12_DIFFICULTY=easy` + `verify_task12_pie.py` | one harness configuration end to end |
| Packaged smoke: run the packaged build with `-BLASmokeTest` | the harness walks all 18 mode/scale/difficulty configurations, the flows test runs each one and the harness exits with `HARNESS_RUN_COMPLETE configurations=18 failures=<n>` in the log |

## Recovery diagnostics

The managers report into `BLADebugSubsystem` (game-instance subsystem, C++) and to the log:

| Event | Emitted by | Meaning |
|-------|-----------|---------|
| `AI_STUCK_RECOVERED` | `ABLAAIController::RecoverFromStuck` | a bot was stuck; the event carries bot, point and whether the team-spawn fallback was used (after two recoveries in one round) |
| `OBJECTIVE_CORE_RESET` | `ABLAObjectiveManager::RecoverCoreIfNeeded` | a core outside the valid area was reset home |
| `OBJECTIVE_INVALID_STATE` | `ABLAObjectiveManager::RecoverCoreIfNeeded` | no valid location exists; the round ends as `ObjectiveInvalidState` with the map name |
| `ROUND_WATCHDOG_EXPIRED` | `ABLARoundManager::Tick` | a phase outlived the watchdog; the round ends as `RoundWatchdogExpired` (duplicate scoring stays guarded by `bIsRoundEnding`) |
| `SPAWN_FALLBACK_USED` | `ABLATeamManager::SelectSpawnPoint` | no team spawn was left; the spawn and the rejection reason are recorded |
| `FORCED_DAMAGE_APPLIED`, `FORCED_OBJECTIVE_ACTION`, `ALL_MVP_FLOWS_OK` | `ABLAAllMVPFlowsTest` | what the flow test forced and that it passed |

## Known gaps

- Solo unattended soaks have no first contact because the human attacker does not move.
- 3v3 still records stuck ticks after the route fix (Team Elimination 832, Data Core 1783) but both stay
  under the 2000 recovery cap, and Data Core is below the origin-collapse baseline of 6756. Recoveries
  include bot and point. See `README.md` and `docs/builds/single-player-release-2026-09-15.md`.
- Unattended 15 s Data Core soaks may not finish upload; the scripted PIE flow and packaged harness do.
- Sight acquisition is a deterministic C++ scan; the AIPerception component still owns hearing/damage stimuli.
- Placeholders stay in place until graybox playtests pass (walls/floors, cover, weapons, bots, lights, VFX/audio).
- This milestone is offline only: no replication, Listen Server, dedicated server, accounts, or matchmaking.

## Single-player milestone acceptance (2026-09-15)

The baseline is recorded in `docs/testing/single-player-baseline-2026-09-15.md`. Before the offline release is called complete:

- Every multi-bot configuration records a first-contact tick.
- Both Team Elimination and Data Core 3v3 soaks observe LeftRoute at least once.
- Each `AI_STUCK_RECOVERED` diagnostic includes the bot and selected point, and repeated recovery does not select one blocked point forever.
- The Data Core scripted flow reaches `Planted` and then `Completed` or `Defused` with no `OBJECTIVE_INVALID_STATE`.
- The full matrix remains `MATRIX_DONE checks=25 failed=0`.
