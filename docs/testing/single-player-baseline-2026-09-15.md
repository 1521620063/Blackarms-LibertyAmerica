# Single-player baseline - 2026-09-15

## Verification

- Command: `pwsh -File Scripts/run_verification.ps1 -Tag singleplayer-baseline`
- Result: `MATRIX_DONE checks=25 failed=0` and `MATRIX_OK`.
- UE: 5.8.2 (CL 56702186).
- Default packaged target remains `/Game/BLA/Maps/Final/L_BLA_ZeroFacility` with `BP_BLAGameMode`.

## Current Zero Facility soak baseline

| Mode | Scale | First contact | Min bot travel | Stuck ticks | Routes seen | Objective states |
|---|---:|---|---:|---:|---|---|
| Team Elimination | Solo | none | 1342.9 | 0 | MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Team Elimination | 2v2 | 78, 1, 1, 1, 1 | 1271.1 | 934 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Team Elimination | 3v3 | 29, 1, 1, 1, 1 | 1342.9 | 21 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Data Core | Solo | none | 1342.9 | 0 | MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Data Core | 2v2 | 94, 1, 1, 1, 1 | 1342.9 | 2391 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn | AVAILABLE |
| Data Core | 3v3 | 94, 1, 1, 1, 1 | 1342.9 | 6756 | AttackSpawn, CenterRoute, MidCombatZone, ObjectiveZone, DefenseSpawn, RightRoute | AVAILABLE |

## Known reproducible gaps

1. LeftRoute is reachable according to the navigation test but is not selected in the six recorded soak configurations.
2. 2v2 and Data Core 3v3 produce high stuck-tick counts at chokepoints.
3. The 15-second unattended observation window usually ends with Data Core still `AVAILABLE`; the scripted Task 12 flow still completes the objective path in PIE and packaged smoke.

## Offline acceptance thresholds for the next milestone

- Every multi-bot configuration records a first-contact tick.
- Both elimination and Data Core 3v3 soaks observe LeftRoute at least once.
- Every `AI_STUCK_RECOVERED` record contains bot name and selected point; repeated recovery must not select the same blocked point forever.
- Data Core flow reaches `Planted` and then `Completed` or `Defused` in the scripted test, with no `OBJECTIVE_INVALID_STATE`.
- The complete matrix remains at 25 checks with zero failures.
