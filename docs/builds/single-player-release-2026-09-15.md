# Offline single-player release — 2026-09-15

Windows PC offline milestone for Blackarms-LibertyAmerica. This release does not include replication, Listen Server, a dedicated server, accounts, or matchmaking.

## Build

| Field | Value |
|-------|-------|
| Date | 2026-09-15 |
| Engine | Unreal Engine 5.8.2 (CL 56702186) |
| Source commit | `ed906bd` `fix: harden offline player flow` |
| Configuration | Development, Win64 |
| Command | `RunUAT.bat BuildCookRun -project=BlackarmsLibertyAmerica.uproject -noP4 -platform=Win64 -clientconfig=Development -cook -map=+/Game/BLA/Maps/Graybox/L_TestBootstrap+/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination+/Game/BLA/Maps/Final/L_BLA_ZeroFacility -build -stage -pak -archive -archivedirectory=D:\dev\BLA-Packaged -utf8output -nocompileeditor` |
| Output | `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe` (bootstrap stub 2026-09-15 17:15:24). Game binary: `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica\Binaries\Win64\BlackarmsLibertyAmerica.exe` (2026-09-15 17:14:53). Package directory is outside the repository. |
| Cook scope | the three maps above; `Config/DefaultGame.ini` keeps `+DirectoriesToAlwaysCook=(Path="/Game/BLA")` because input actions, rules/difficulty data assets and UI classes are only referenced from C++ string paths |
| UAT | `BUILD SUCCESSFUL`, AutomationTool `ExitCode=0`, `BuildCookRun time: 111.22 s` |

## Editor matrix

Command:

```powershell
pwsh -File Scripts/run_verification.ps1 -Tag singleplayer-release
```

Do not pass `-Soak`. Soak would add two 3v3 Zero Facility runs and report 27 checks.

| Field | Value |
|-------|-------|
| Result | `MATRIX_DONE checks=25 failed=0` / `MATRIX_OK` |
| Stdout | `Saved/Logs/verify_matrix_singleplayer-release_stdout.txt` |
| Coverage | Task 2-12 contracts, bootstrap PIE, Task 2-7 PIE, Task 8 team-size 1/2/3, Task 9 Data Core, Task 10 UI travel, Task 11 Zero Facility navigation, Task 12 all-flows harness |

Selected markers:

- `BLA_TASK10_CONTRACTS_OK ... flow_guards=1`
- `BLA_TASK11_CONTRACTS_OK ... attack_points=3`
- `BLA_PIE_VERIFY_OK pawn=BLAPlayerCharacter_4 moved=460.80`
- `BLA_TASK7_PIE_DRIVER_OK ticks=240 game_mode=elimination`
- `BLA_TASK8_PIE_DRIVER_OK ticks=300 team_size=1 registration=2 duplicates=0 moved=815.0`
- `BLA_TASK8_PIE_DRIVER_OK ticks=300 team_size=2 registration=4 duplicates=0 moved=669.4`
- `BLA_TASK8_PIE_DRIVER_OK ticks=300 team_size=3 registration=6 duplicates=0 moved=1357.6`
- `BLA_TASK9_PIE_DRIVER_OK ticks=300 datacore=ok`
- `BLA_TASK10_PIE_DRIVER_OK menu=1 match=1 travel=roundtrip`
- `BLA_TASK11_PIE_DRIVER_OK ticks=900 navigation=1 moved=1697.9`
- `BLA_TASK12_PIE_DRIVER_OK mode=data_core size=3 difficulty=hard result=OK mode=1 size=3 difficulty=2 flows_events=1`

## Packaged smoke

```powershell
& "D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe" -BLASmokeTest -nullrhi -nosound -unattended -abslog=D:\dev\Blackarms-LibertyAmerica\Saved\Logs\SmokePackaged-singleplayer-release.log
```

| Metric | Value |
|--------|-------|
| Result | `HARNESS_RUN_COMPLETE configurations=18 failures=0` |
| Configurations | Team Elimination and Data Core × Solo/2v2/3v3 × Easy/Normal/Hard |
| Per config | `HARNESS_CONFIGURATION_STARTED`, `ALL_MVP_FLOWS_OK`, `HARNESS_CONFIGURATION_RESULT OK` |
| Log | `Saved/Logs/SmokePackaged-singleplayer-release.log` |

This is the packaged harness path. It is not a substitute for the 25-check editor matrix.

## 3v3 soak evidence (Task 2, tag=`singleplayer-routes`)

Task 5 did not re-run soak. These are the current Zero Facility 3v3 numbers after the route and recovery fix.

| Mode | First contact | Min bot travel | Stuck ticks | Pre-fix stuck | Routes include LeftRoute | Recoveries |
|------|---------------|----------------|-------------|---------------|--------------------------|------------|
| Team Elimination | 137, 1, 1, 1, 1 | 908.1 | 832 | 21 | yes | 30 |
| Data Core | 56, 1, 1, 1, 1 | 1661.4 | 1783 | 6756 | yes | 40 |

Solo unattended soaks still have no first contact: the human attacker is the only non-bot on the attacking side and does not move.

## Known limitations

- Offline only: no replication, Listen Server, dedicated server, accounts, or public matchmaking.
- Solo unattended soak has no first contact because the human attacker does not move.
- 3v3 still records stuck ticks (Elimination 832, Data Core 1783). Data Core is below the origin-collapse baseline of 6756, and both stay under the 2000 recovery cap. Recoveries include bot and point.
- Unattended 15 s Data Core soak may not finish upload; the scripted PIE flow and packaged harness do reach plant/upload/round result.
- Graybox placeholders remain (walls/floors, cover, weapons, bots, lights, VFX/audio).
- The 18 smoke configurations cover packaged travel and forced flows, not editor contract/PIE drivers.

## LAN invariants

LAN work is deferred to `docs/superpowers/plans/2026-09-15-lan-listen-server.md` after this milestone. Allowed follow-up scope:

1. LAN Listen Server
2. Server-authoritative match truth (damage, objective, score, spawn)
3. AI fill for empty slots
4. Disconnect returns remaining players to the menu

Dedicated server, accounts, matchmaking, and public online services stay out of that follow-up.
