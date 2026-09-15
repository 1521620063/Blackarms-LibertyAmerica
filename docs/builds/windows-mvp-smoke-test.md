# Windows MVP smoke test

## Build

| Field | Value |
|-------|-------|
| Date | 2026-09-15 |
| Engine | Unreal Engine 5.8.2 (CL 56702186) |
| Configuration | Development, Win64 |
| Command | `RunUAT.bat BuildCookRun -project=BlackarmsLibertyAmerica.uproject -noP4 -platform=Win64 -clientconfig=Development -cook -map=+/Game/BLA/Maps/Graybox/L_TestBootstrap+/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination+/Game/BLA/Maps/Final/L_BLA_ZeroFacility -build -stage -pak -archive -archivedirectory=D:\dev\BLA-Packaged -utf8output -nocompileeditor` |
| Output | `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe` (outside the repository) |
| Cook scope | the three maps above; `Config/DefaultGame.ini` adds `+DirectoriesToAlwaysCook=(Path="/Game/BLA")` because input actions, rules/difficulty data assets and UI classes are only referenced from C++ string paths and are otherwise invisible to the cooker |

Result: `BUILD SUCCESSFUL` (AutomationTool exit 0, ~80 s incremental cook + stage + pak + archive).

## Automated smoke run

```powershell
& "D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe" -BLASmokeTest -nullrhi -nosound -unattended -abslog=D:\dev\Blackarms-LibertyAmerica\Saved\Logs\SmokePackaged6.log
```

The packaged build starts on the menu map; `ABLATestHarness` sees `-BLASmokeTest`, walks all 18
mode/scale/difficulty configurations, and each one travels to `L_BLA_ZeroFacility`, runs
`ABLAAllMVPFlowsTest` (HUD read-back, forced damage, forced objective action, round result, match result,
restart) and travels back. The run ends with `HARNESS_RUN_COMPLETE` and exits.

### Result of the 2026-09-15 run

| Metric | Value |
|--------|-------|
| Configurations started | 18 / 18 |
| Configurations passed | 18 / 18 |
| Failures | 0 / 18 |
| Coverage | Team Elimination and Data Core, Solo/2v2/3v3, Easy/Normal/Hard - every configuration runs HUD read-back, forced damage, forced objective action (Data Core), round result, match result, restart and the return to menu |
| Travel | every configuration loaded `L_BLA_ZeroFacility` and returned to the menu map, no `TravelFailure` |
| Content | no `Failed to find object` warnings after adding `DirectoriesToAlwaysCook` and the explicit map cook list |
| Log | `Saved\Logs\SmokePackaged8.log` (`HARNESS_RUN_COMPLETE configurations=18 failures=0`) |

## Defect found and fixed by this run

The first packaged runs failed every Data Core configuration in the scripted plant step while the same
configuration passed in PIE. The harness detail line showed `state=1` (Available), `cancel=None`,
`remaining=0.00`, `in_zone=1`, `interacting=0`: the flow test started the plant before the objective manager
had observed the round transition into Preparation, and the manager's first observation of Preparation resets
the objective by design - so the forced plant was wiped. The flow test now calls `Objective->Tick(0.0f)` once
before forcing the interaction (absorbing the phase transition); the packaged smoke then passed 18/18.

This is a frame-order race, which is why the editor PIE run passed and the faster packaged build did not.

## Manual checklist (optional human verification)

The automated harness already covers these scenarios for every mode/scale/difficulty; a human pass is still
worth running before wider distribution:

1. Launch `BlackarmsLibertyAmerica.exe` and confirm the main menu appears over the bootstrap map.
2. Start a Team Elimination match at Solo, 2v2 and 3v3; play one round; confirm the HUD, results screen,
   restart and return to menu.
3. Repeat for Data Core (pick up, plant, defuse, upload).
4. Quit and relaunch; confirm saved settings persist.
