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

`Scripts/run_verification.ps1` runs the full verification matrix (Task 2-9 contract scripts, the bootstrap/PIE drivers, the team-size 1/2/3 runs and the Data Core driver) through `UnrealEditor-Cmd.exe` and enforces the marker contract: each run must emit its `BLA_*_OK` marker, and any `_FAILED` marker, missing marker, or timeout fails the matrix with a non-zero exit code.

```powershell
pwsh -File Scripts/run_verification.ps1
pwsh -File Scripts/run_verification.ps1 -Only verify_task9_pie
```

Run it with no other `UnrealEditor-Cmd.exe` process active: a second instance silently loses the project lock and produces an empty log. Logs are written to `Saved/Logs/V_<check>_<tag>.log`.

Content generators must be run in order (`bootstrap_project.py` then `build_task2_assets.py` … `build_task10_assets.py`). Each generator now destroys only the actors it owns, so re-running one generator no longer deletes another task's level content.

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
bot travel, stuck ticks, route usage and the objective states it observed. Results of the 2026-09-15 run
(six configurations, 30 matches, 15 s observation per match):

| Mode | Scale | First contact (ticks) | Min bot travel | Stuck ticks | Routes seen | Objective states |
|------|-------|----------------------|----------------|-------------|-------------|------------------|
| Team Elimination | Solo | none | 1342.9 | 0 | MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Team Elimination | 2v2 | 78, 1, 1, 1, 1 | 1271.1 | 934 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Team Elimination | 3v3 | 29, 1, 1, 1, 1 | 1342.9 | 21 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Data Core | Solo | none | 1342.9 | 0 | MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Data Core | 2v2 | 94, 1, 1, 1, 1 | 1342.9 | 2391 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Data Core | 3v3 | 94, 1, 1, 1, 1 | 1342.9 | 6756 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn, RightRoute | AVAILABLE |

Reading of these results (2026-09-15):

- Contact happens in every multi-bot configuration, and bots travel 1200+ units per match, so routing and
  combat work on the new map. Solo stays quiet because the human player is the only attacker and does not move
  in an unattended run.
- Bots only use the center and right routes; the left route was never entered in 30 matches. It is reachable
  (the navigation test checks it), it is simply not preferred by the current tactical points, so the left
  corridor needs either a tactical point of its own or an AI weighting change.
- Stuck ticks grow with team size (up to 6756 in 3v3 Data Core, i.e. several bots waiting at chokepoints). The
  corridors and objective entries pass the navigation test, but the AI still jams when several bots share one
  entry; widen or stagger the objective entries before human playtesting.
- The objective stayed `AVAILABLE` in all 30 matches: attacker bots walk towards the core but do not reach and
  pick it up inside the 15 s window. Longer matches and/or stronger objective weighting are needed before the
  Data Core mode can be called complete from a gameplay point of view.
- No spawn overlap, no unrecoverable corner and no direct spawn-to-spawn sight were reported by
  `FT_BLA_MapNavigation` in any run.
