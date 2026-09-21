# Blackarms-LibertyAmerica (黑枪-自由美利坚)

Offline tactical team shooter MVP built with Unreal Engine 5.8.2 (CL 56702186) for Windows PC.

Project tag `BLA`: the runtime module is `BLA`, the editor module is `BLAEditor`, content lives under `Content/BLA`, and assets carry the `BLA` tag (`BP_BLACharacterBase`, `WBP_BLAMatchHUD`, `BT_BLABotElimination`, …).

## Open The Project

1. Install Unreal Engine 5.8.2.
2. Open `BlackarmsLibertyAmerica.uproject` from this repository root.
3. Let Unreal compile shaders and discover assets on the first launch.
4. Open `/Game/BLA/Maps/Graybox/L_TestBootstrap` if it is not already loaded.
5. Use Play In Editor to run the project.

The project uses the Blueprint First Person template and Enhanced Input. The Windows target uses DirectX 12 and Shader Model 6 by default.

## Architecture Rule

Do not place gameplay rules in a Level Blueprint. Match truth belongs to GameMode, GameState, PlayerState, and the dedicated managers and components described in the implementation plan. Level Blueprints must remain empty except for editor-only diagnostics explicitly approved by the plan.

## Editor Automation

Editor-only Python scripts live in `Scripts/Editor`. They create and validate Unreal assets; they are not available in PIE or packaged builds.

## Verification

`Scripts/run_verification.ps1` runs the full 25-check matrix (Task 2-12 contract scripts, bootstrap/PIE drivers, team-size 1/2/3 runs, Data Core, UI flow, Zero Facility navigation, and the all-flows harness) through `UnrealEditor-Cmd.exe` and enforces the marker contract: each run must emit its `BLA_*_OK` marker, and any `_FAILED` marker, missing marker, or timeout fails the matrix with a non-zero exit code.

```powershell
pwsh -File Scripts/run_verification.ps1
pwsh -File Scripts/run_verification.ps1 -Only verify_task12_pie
```

Do not pass `-Soak` for the release matrix: soak adds two 3v3 Zero Facility runs and reports 27 checks. Run it with no other `UnrealEditor-Cmd.exe` process active: a second instance silently loses the project lock and produces an empty log. Logs are written to `Saved/Logs/V_<check>_<tag>.log`.

Content generators must be run in order (`bootstrap_project.py` then `build_task2_assets.py` … `build_task12_assets.py`). Each generator now destroys only the actors it owns, so re-running one generator no longer deletes another task's level content.

The 2026-09-15 offline single-player release evidence is in `docs/builds/single-player-release-2026-09-15.md`.

## Zero Facility Map (Task 11)

`/Game/BLA/Maps/Final/L_BLA_ZeroFacility` is the playable graybox built by `Scripts/Editor/build_task11_assets.py`:
eight zones (AttackSpawn, LeftRoute, CenterRoute, RightRoute, MidCombatZone, ObjectiveZone, FlankZone,
DefenseSpawn), three spawn points per team, all seven tactical point types, low/high/directional cover, a flank
corridor, the Data Core objective set and a `BP_BLAMapConfig` actor holding
`DA_BLAMapConfig_ZeroFacility` (supported modes: Team Elimination + Data Core; sizes Solo/2v2/3v3).
The elimination game mode reads that config instead of searching the level by class name; the Recast navmesh
is set to dynamic runtime generation so PIE and packaged builds rebuild navigation from the bounds volume.

### Five-match soak per mode and scale

`Scripts/Editor/verify_task11_soak.py` runs five matches for one mode/scale pair (select it with
`BLA_TASK11_SOAK_MODE=elimination|data_core` and `BLA_TASK11_SOAK_SIZE=1|2|3`) and reports first contact,
bot travel, stuck ticks, route usage and the objective states it observed.

Current 3v3 evidence is the Task 2 run (`tag=singleplayer-routes`) after tactical points received real
transforms and per-lane scoring. Solo/2v2 rows below are the morning baseline from before that fix.

| Mode | Scale | First contact (ticks) | Min bot travel | Stuck ticks | Routes seen | Notes |
|------|-------|----------------------|----------------|-------------|-------------|-------|
| Team Elimination | Solo | none | 1342.9 | 0 | MidCombatZone, ObjectiveZone, DefenseSpawn | unattended human attacker does not move |
| Team Elimination | 2v2 | 78, 1, 1, 1, 1 | 1271.1 | 934 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | pre-fix baseline; not re-soaked in Task 2-5 |
| Team Elimination | 3v3 | 137, 1, 1, 1, 1 | 908.1 | 832 | AttackSpawn, CenterRoute, DefenseSpawn, FlankZone, LeftRoute, MidCombatZone, ObjectiveZone, RightRoute | post-fix; 30 recoveries |
| Data Core | Solo | none | 1342.9 | 0 | MidCombatZone, ObjectiveZone, DefenseSpawn | unattended human attacker does not move |
| Data Core | 2v2 | 94, 1, 1, 1, 1 | 1342.9 | 2391 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | pre-fix baseline; not re-soaked in Task 2-5 |
| Data Core | 3v3 | 56, 1, 1, 1, 1 | 1661.4 | 1783 | AttackSpawn, CenterRoute, DefenseSpawn, LeftRoute, MidCombatZone, ObjectiveZone | post-fix; 40 recoveries; previous stuck=6756 |

Reading of these results (2026-09-15):

- Contact happens in every multi-bot configuration that was soaked. Solo stays quiet because the human
  player is the only attacker and does not move in an unattended run.
- After the Task 2 route fix, both 3v3 modes select LeftRoute. Elimination also covers RightRoute and FlankZone.
- 3v3 still records stuck ticks, but Data Core dropped from 6756 to 1783 and both modes stay under the 2000
  recovery cap. Recoveries include bot and point.
- Unattended 15 s Data Core soak may not finish upload. The scripted PIE flow and the packaged 18-configuration
  harness do reach plant/upload/round result.
- No spawn overlap, no unrecoverable corner and no direct spawn-to-spawn sight were reported by
  `FT_BLA_MapNavigation` in the navigation PIE driver.

## Windows package

Development Win64 package path: `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe` (outside the repository).

```powershell
& "D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe" -BLASmokeTest -nullrhi -nosound -unattended
```

The 2026-09-15 offline milestone recorded `HARNESS_RUN_COMPLETE configurations=18 failures=0`. Details are in
`docs/builds/single-player-release-2026-09-15.md`. The earlier morning MVP package record remains in
`docs/builds/windows-mvp-smoke-test.md`.

## LAN Listen Server

Windows PC LAN uses a listen server on port 7777 (`IpNetDriver`). The menu stays standalone.
Host travel is `MatchMapPath?listen`. Join is a direct IPv4 (`127.0.0.1` or `IP:7777`).
Waiting happens on the match map. Players pick Attack/Defense. The host starts the match and empty slots are filled with the existing `SpawnBot()` path.

Unattended flags (not shown on the Shipping menu):

- Host: `-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5`
- Client: `-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders`

LAN editor checks are extra `-Only` targets and are not part of the default 25-check offline matrix:

```powershell
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_contracts
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -TimeoutSeconds 420
pwsh -File Scripts/run_lan_packaged_smoke.ps1
```

No Steam, no matchmaking, no Dedicated Server. LAN uses the same Zero Facility `MatchMapPath` as offline `RequestStartMatch()`.
