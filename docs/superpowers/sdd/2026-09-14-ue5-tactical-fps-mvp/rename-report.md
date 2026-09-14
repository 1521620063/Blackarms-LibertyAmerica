# Rename report — Blackarms-LibertyAmerica (BLA)

## Result

The project ships as **Blackarms-LibertyAmerica (黑枪-自由美利坚)**, tagged `BLA`, with the whole pipeline verified after the rename.

| Element | New value |
|---------|-----------|
| Project file | `BlackarmsLibertyAmerica.uproject` |
| Targets | `BlackarmsLibertyAmerica`, `BlackarmsLibertyAmericaEditor` |
| Modules | `BLA` (runtime), `BLAEditor` (editor) |
| API macros | `BLA_API`, `BLAEDITOR_API` |
| C++ types | `ABLA*`, `UBLA*`, `FBLA*`, `EBLA_*` |
| Content root | `Content/BLA`, `/Game/BLA` |
| Asset tags | `BP_BLA*`, `WBP_BLA*`, `BT_BLABot*`, `BB_BLABot`, `BTT_BLA*`, `BTS_BLA*`, `BPD_BLA*`, `DA_BLA*`, `FT_BLA*`, `IMC_BLAPlayer`, `L_BLA_1v1_Elimination` |
| Verify markers | `BLA_TASK*_CONTRACTS_OK`, `BLA_*_PIE_DRIVER_OK`, `BLA_DATACORE_OK`, `BLA_PIE_VERIFY_OK` |
| Display name | 黑枪-自由美利坚 (`Config/DefaultGame.ini`) |

## What was done

1. Branch `codex/rename-blackarms-liberty-america`; `main` stayed at `88dc930` until verification passed.
2. `git mv` for the module folders, both target files, all 73 `FPS*` sources, and `FPS.uproject`; identifier rewrite across `Source/` (`FPS_API`→`BLA_API`, `EFPS_`→`EBLA_`, `FFPS`→`FBLA`, `UFPS`→`UBLA`, `AFPS`→`ABLA`, remaining `FPS`→`BLA`).
3. `Config/DefaultEngine.ini`: new map paths, `GameInstanceClass=/Script/BLA.BLAGameInstance`, and 62 `[CoreRedirects]` entries (class, struct, enum, package) so pre-rename references still resolve.
4. `Config/DefaultGame.ini`: project name, display title, description.
5. Content rebuilt from the generators under the new root (see the rename plan for why moving was abandoned).
6. `Scripts/Editor/*.py`, `README.md`, the MVP plan, and the specs rewritten; the genre word "FPS" stays only where it means first-person shooter.
7. Clean rebuild produced `UnrealEditor-BLA.dll` / `UnrealEditor-BLAEditor.dll`.

## Verification (fresh logs after the rename)

```text
BLA_TASK2_CONTRACTS_OK  BLA_TASK3_CONTRACTS_OK  BLA_TASK4_CONTRACTS_OK
BLA_TASK5_CONTRACTS_OK  BLA_TASK6_CONTRACTS_OK  BLA_TASK7_CONTRACTS_OK
BLA_TASK8_CONTRACTS_OK  BLA_TASK9_CONTRACTS_OK
BLA_PIE_VERIFY_OK  BLA_TASK7_PIE_DRIVER_OK  BLA_TASK9_PIE_DRIVER_OK (datacore=ok)
BLA_TASK8_PIE_DRIVER_OK team_size=1 / 2 / 3
```

Logs: `Saved/Logs/V_*.log`, `V_task8_pie_{1,2,3}.log`, rebuild logs `Saved/Logs/Rebuild_*.log`.

## Failure found and fixed (do not repeat)

Moving assets across a module rename destroys struct- and enum-typed data even with `[CoreRedirects]` in place: property tags resolve by object path, and neither `+StructRedirects=` nor `+EnumRedirects=` restored them. Symptom: `DA_BLAMatchRules_2v2.team_size` read back as 1, weapon data as `EnergyPistol`, interface enum pins as plain bytes. Loading an untouched pre-rename asset with the renamed module present reproduced it, which proved the loss is in deserialization, not in the rename script. Content was therefore regenerated instead of moved.
