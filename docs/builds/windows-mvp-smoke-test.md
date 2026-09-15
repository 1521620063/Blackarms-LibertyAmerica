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
| Configurations passed | 9 / 18 |
| Failures | 9 / 18 |
| Coverage | Team Elimination Solo/2v2/3v3 × Easy/Normal/Hard: pass; Data Core Solo/2v2/3v3 × Easy/Normal/Hard: fail in the forced plant step (`BLA_ALL_MVP_FLOWS_FAILED reason=forced_plant_complete`) |
| Travel | every configuration loaded `L_BLA_ZeroFacility` and returned to the menu map, no `TravelFailure` |
| Content | no `Failed to find object` warnings after adding `DirectoriesToAlwaysCook` and the explicit map cook list |
| Log | `Saved\Logs\SmokePackaged6.log` |

So the packaged entry flow, multi-map travel, HUD read-back, forced damage, round result, match result and
restart all work in the packaged build for Team Elimination at every scale and difficulty. The Data Core
configurations still fail the scripted plant step in the packaged build even though the same configuration
passes in PIE; the next action is to read the harness detail line (the harness now logs
`HARNESS_CONFIGURATION_RESULT` with the objective state, cancel reason and actor locations) and fix the
packaged-only path before the `release: package Windows FPS MVP` commit.

## Manual checklist (still to run after the Data Core fix)

1. Launch `BlackarmsLibertyAmerica.exe` and confirm the main menu appears over the bootstrap map.
2. Start a Team Elimination match at Solo, 2v2 and 3v3; play one round; confirm the HUD, results screen,
   restart and return to menu.
3. Repeat for Data Core (pick up, plant, defuse, upload).
4. Quit and relaunch; confirm saved settings persist.
