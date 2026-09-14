# Project rename — Blackarms-LibertyAmerica (黑枪-自由美利坚)

**Goal:** replace the working name `FPS` everywhere in the project with the shipped name, so the repository, the module, the classes, the assets, the configuration, and the automation all read as one product.

This rename is authorised by the human partner and overrides the MVP plan's global constraint "do not perform broad renames".

## Naming decisions

| Element | Old | New |
|---------|-----|-----|
| Project file | `FPS.uproject` | `BlackarmsLibertyAmerica.uproject` |
| Game target | `FPS` | `BlackarmsLibertyAmerica` |
| Editor target | `FPSEditor` | `BlackarmsLibertyAmericaEditor` |
| Runtime module | `FPS` | `BLA` |
| Editor module | `FPSEditor` | `BLAEditor` |
| API macro | `FPS_API` | `BLA_API` |
| C++ type prefixes | `AFPS*`, `UFPS*`, `FFPS*`, `EFPS_*` | `ABLA*`, `UBLA*`, `FBLA*`, `EBLA_*` |
| Source folders | `Source/FPS`, `Source/FPSEditor` | `Source/BLA`, `Source/BLAEditor` |
| Content root | `Content/FPS`, `/Game/FPS` | `Content/BLA`, `/Game/BLA` |
| Asset names | `BP_FPSCharacterBase` | `BP_BLACharacterBase` (same rule for `WBP_`, `BT_`, `BB_`, `BTT_`, `BTS_`, `BPD_`, `DA_`, `FT_`, `IMC_`) |
| Map names | `L_FPS_1v1_Elimination` | `L_BLA_1v1_Elimination` |
| Test markers | `FPS_TASK9_CONTRACTS_OK`, `FPS_DATACORE_OK`, … | `BLA_TASK9_CONTRACTS_OK`, `BLA_DATACORE_OK`, … |
| Display title | `FPS` | `黑枪-自由美利坚` (`Blackarms-LibertyAmerica`) |

`BLA` is the acronym tag the human partner's instruction delegates ("asset prefixes follow the new name's characteristics"). Every rename is driven by a parameterised script, so changing the tag later is a re-run, not a rewrite.

## Why this is staged

Renaming the runtime module invalidates every Blueprint's parent-class path (`/Script/FPS.FPSCharacterBase`), and renaming content invalidates every reference to `/Game/FPS/...`. Both are recoverable only if the redirects exist before the editor loads anything, so the order is fixed: code and config first, content second, then automation, then the full verification matrix.

## Stages

### Stage 1 — module, code, project files, config (no editor)

1. Branch `codex/rename-blackarms-liberty-america`.
2. `git mv` the module folders, target files, build files, every `FPS*.h/.cpp`, and `FPS.uproject`.
3. Rewrite identifiers in `Source/`: `FPS_API`→`BLA_API`, `FPSEDITOR_API`→`BLAEDITOR_API`, `EFPS_`→`EBLA_`, `FFPS`→`FBLA`, `UFPS`→`UBLA`, `AFPS`→`ABLA`, then the remaining `FPS`→`BLA` (covers includes, module names, `/Script/FPS.`, `/Game/FPS/`, log markers).
4. Rewrite target/build classes and `ExtraModuleNames`; rewrite the `.uproject` module list.
5. `Config/DefaultEngine.ini`: new map paths, new `GameInstanceClass`, and a `[CoreRedirects]` block that maps every old `/Script/FPS.<Class>` to `/Script/BLA.<Class>` so existing Blueprints still resolve their parents.
6. `Config/DefaultGame.ini`: project name, display title, description.
7. Clean rebuild: delete `Binaries/`, `Intermediate/` for the project, build `BlackarmsLibertyAmericaEditor Win64 Development`.

### Stage 2 — content rebuild (editor, scripted)

The first attempt moved the existing assets with `EditorAssetLibrary.rename_asset` and failed in a way worth recording: renaming the runtime module moves the C++ types from `/Script/FPS.*` to `/Script/BLA.*`, and while class references survive via `ClassRedirects`, **struct- and enum-typed property data does not**. Serialized property tags store the struct/enum object path; redirects do not restore them, so every `FFPSMatchRules`, `FFPSBotDifficulty`, and `FFPSWeaponData` value silently fell back to its C++ default, and Blueprint interface pins lost their enum type. `+StructRedirects=` / `+EnumRedirects=` did not help (verified by loading an untouched pre-rename asset with the renamed module in place: `team_size` read back as the default 1).

Rebuilding the content from its own generators is therefore the sanctioned path, and it is cheap because every asset in `Content/BLA` is script-authored:

1. Remove `Content/BLA`, `Content/__ExternalActors__/BLA`, `Content/__ExternalObjects__/BLA`, and `Saved/AssetRegistry.bin` (stale package paths).
2. Run the generators in dependency order: `bootstrap_project.py`, then `build_task2_assets.py` … `build_task9_assets.py`, each logging its `BLA_*_ASSETS_BUILT` marker.
3. Re-run the full verification matrix (Stage 4).

Hand-authored content is untouched by this: the only non-generated content in the project is the First Person template under `Content/FirstPerson`, which keeps its own names.

### Stage 3 — configuration, automation, documentation

1. `Config/*`: map paths, game mode paths, input mappings if any carry the tag.
2. `Scripts/Editor/*.py`: `/Game/FPS`→`/Game/BLA`, `unreal.FPS*`→`unreal.BLA*`, `FPS_*` markers→`BLA_*`, and the renamed script file names.
3. `README.md` and the plan/spec docs: the product name; the genre word "FPS" in prose stays where it means first-person shooter.

Stage 3 also has to fix the generators' own constants: a blanket text replacement inside `Scripts/Editor` rewrites a migration script's source and destination into the same value, so the rename tooling keeps explicit `OLD_*`/`NEW_*` constants.

### Stage 4 — verification (the gate)

Re-run the complete matrix with the new names:

- Task 2–9 contract suites, all logging `BLA_TASK*_CONTRACTS_OK`.
- Task 7, Task 8 (team sizes 1/2/3), Bootstrap PIE, and Task 9 PIE (`BLA_DATACORE_OK`, `BLA_TASK9_PIE_DRIVER_OK`).
- `git status` clean, one rename commit plus one plan/verification commit, pushed to `origin/main`.

Nothing merges unless every marker above appears in the new logs; a partially renamed tree is worse than the old name.

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| Blueprint assets lose their C++ parent class | `[CoreRedirects]` in `DefaultEngine.ini` before any editor run; class redirects do work and kept every Blueprint parent intact |
| Struct/enum data in assets silently resets | Rebuild the content from the generators instead of moving it (Stage 2); `+StructRedirects=` is not sufficient |
| Stale asset-registry entries rename or delete the wrong packages | Delete `Saved/AssetRegistry.bin` and rebuild content rather than sweeping paths with the registry |
| Map references break when `/Game/FPS` moves | Maps are regenerated by `build_task7/8/9_assets.py`, which also re-place every actor with its new label |
| Stale binaries keep the old module alive | Delete `Binaries/` and `Intermediate/` before the rebuild; verify `UnrealEditor-BLA.dll` is produced |
| Verification scripts silently pass against the old names | Stage 3 renames markers; Stage 4 requires the new markers in fresh logs |
| Rename half-applied on failure | Work on a branch; `main` stays at the last verified commit (`88dc930`) until Stage 4 passes |

## Rollback

`main` is untouched during the work. Abandoning the branch restores the verified state exactly; the rename script is idempotent and re-runnable on a fresh branch.
