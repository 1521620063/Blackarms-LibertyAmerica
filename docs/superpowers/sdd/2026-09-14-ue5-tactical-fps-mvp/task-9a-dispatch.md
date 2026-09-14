# Task 9A dispatch — objective core + state-machine test (implementer instructions)

Project root: `D:\dev\Blackarms-LibertyAmerica` (Unreal Engine 5.8, C++ + Python editor automation).
Requirements, exact values, and evidence rules: `docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/task-9-brief.md` — read it first; it is the single source of requirements.

## Your scope (first half of Task 9; a second agent later adds the AI tree to the same files)

1. Implement native classes:
   - `Source/FPS/Public/FPSDataCore.h` + `Source/FPS/Private/FPSDataCore.cpp` — `AFPSDataCore`.
   - `Source/FPS/Public/FPSObjectiveZone.h` + `Source/FPS/Private/FPSObjectiveZone.cpp` — `AFPSObjectiveZone`.
   - `Source/FPS/Public/FPSObjectiveManager.h` + `Source/FPS/Private/FPSObjectiveManager.cpp` — `AFPSObjectiveManager`.
2. Implement the native functional test actor `AFPSDataCoreTest` (`Source/FPS/Public/FPSDataCoreTest.h`, `Source/FPS/Private/FPSDataCoreTest.cpp`) covering the plan bullet "Test pickup, drop, repickup, plant interruption, plant, defuse interruption, defuse, upload, timeout, and reset".
3. Write `Scripts/Editor/build_task9_assets.py`, `Scripts/Editor/verify_task9_contracts.py`, `Scripts/Editor/verify_task9_pie.py`.
4. `build_task9_assets.py` also places the core, the objective zone, and the PlantPoint/DefusePoint tactical points into `/Game/FPS/Maps/Graybox/L_FPS_1v1_Elimination` additively and re-runnably, without disturbing the Task 7/8 actors (spawn points, cover cubes, navmesh bounds, both existing functional test actors, fixed spectator camera).

Do NOT create the `BTT_FPS*` objective tasks or `BT_FPSBotObjective` — the second agent owns those. Do not modify `FPSAIController` in this dispatch.

## Interfaces and conventions from earlier tasks

- Gameplay logic lives in C++ (`Source/FPS/Public|Private/FPS*.h/.cpp`); Blueprint assets are thin subclasses created by Python. Native test actors self-execute in `BeginPlay` and log one `FPS_<NAME>_OK detail...` or `FPS_<NAME>_FAILED reason=<token>` line.
- Study these for exact style, do not invent a new one: `Source/FPS/Private/FPS3v3EliminationTest.cpp`, `Source/FPS/Private/FPS1v1EliminationTest.cpp`, `Scripts/Editor/build_task8_assets.py`, `Scripts/Editor/verify_task8_contracts.py`, `Scripts/Editor/verify_task8_pie.py`, `Scripts/Editor/build_task7_assets.py`.
- `FFPSMatchRules` already carries `PlantSeconds=5`, `DefuseSeconds=5`, `UploadSeconds=30`, `ObjectiveCount=1`; `AFPSGameState` already carries `CurrentObjectiveState`; `EFPS_ObjectiveState` already has every state the plan names. Reuse them; do not add parallel enums.
- `AFPSRoundManager::EndRound(EFPS_Team, FName)` is the only win router and is already guarded against double scoring (`bIsRoundEnding`). `AFPSRoundManager::EvaluateTimeout()` already routes `TimeoutLivingCount` / `TimeoutHealth` / `OvertimeDraw`. Your manager calls `EndRound(Attackers, "ObjectiveUploaded")` and `EndRound(Defenders, "ObjectiveDefused")`; do not re-implement elimination or timeout.
- `AFPSTeamManager::OnCombatantDeath` (native delegate) is how death is observed elsewhere. `UFPSHealthComponent::ApplyDamage`, `OnDeathNative`, `ResetHealth` exist. `AFPSCharacterBase::ResetCombatant()` resets a combatant.
- `AFPSTacticalPoint` already has `PlantPoint` and `DefusePoint` in `EFPS_TacticalPointType`; place them through the Python script rather than adding new types.
- Keep the Level Blueprint empty. Do not add plugins. Do not rename existing assets.

## Editor invocation (exact)

```text
"D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "D:\dev\Blackarms-LibertyAmerica\FPS.uproject" -unattended -nop4 -nosplash -nullrhi -NoSound -ExecCmds="py D:/dev/Blackarms-LibertyAmerica/Scripts/Editor/<script>.py" -abslog="D:\dev\Blackarms-LibertyAmerica\Saved\Logs\<name>.log"
```

Each run builds C++ if needed, then runs the Python file; the script calls `quit_editor` itself. Run as one foreground command with a long timeout (1-5 minutes; the first C++ build can take longer). Verify by reading the log for the expected marker. If a run produces no marker, check whether `UnrealEditor-Cmd.exe` is still running, kill it, and re-run. Never run two `UnrealEditor-Cmd` invocations at the same time.

## Definition of done (all four required)

1. `FPS_TASK9_CONTRACTS_OK` in a contracts run log.
2. `FPS_TASK9_PIE_DRIVER_OK` in a PIE run log, with `FPS_DATACORE_OK` present (asserting pickup, drop, repickup, plant interruption, plant, defuse interruption, defuse, upload, timeout routing, idempotent reset).
3. Regression: every Task 2-8 contract script still logs its OK marker, and the Task 7 + Task 8 PIE runs still log `FPS_1V1_ELIMINATION_OK` and `FPS_3V3_ELIMINATION_OK`.
4. One git commit with message exactly `feat: add data core attack and defense mode`. Do not push, do not amend or rebase existing commits, leave the working tree clean.

## Report

Write the full report (files created, exact commands run, raw OK/FAILED log lines, test evidence, anything unverified, concerns) to
`docs/superpowers/sdd/2026-09-14-ue5-tactical-fps-mvp/task-9a-report.md`.
Return only: status (DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED), the commit SHA, a one-line test summary, and concerns. Never spawn subagents; review comes from the controller after your report.
