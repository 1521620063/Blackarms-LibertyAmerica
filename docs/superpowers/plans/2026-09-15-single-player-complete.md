# Blackarms-LibertyAmerica Single-Player Complete Implementation Plan

This plan covers the offline single-player milestone before LAN expansion.

## Global Constraints

- Windows PC offline play only; no replication, Listen Server, Dedicated Server, accounts, matchmaking, or public online services.
- Keep Zero Facility and `BP_BLAGameMode` as the playable defaults.
- Keep gameplay truth in GameMode/GameState/RoundManager/ObjectiveManager; no gameplay rules in Level Blueprints.
- All plans, test evidence, and known issues go under `docs/`.

## Task 1: Freeze the offline baseline

Files: create `docs/testing/single-player-baseline-2026-09-15.md`; modify `docs/testing/mvp-test-matrix.md`.

- [x] Run `Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force`.
- [x] Run `pwsh -File Scripts/run_verification.ps1 -Tag singleplayer-baseline`.
- [x] Record `MATRIX_DONE`, Task 11 soak summaries, Task 12 PIE marker, first contact, route use, stuck ticks, objective states, and round results.
- [x] Add acceptance rules: every multi-bot configuration has first contact; every enabled route is selected; recovery events include bot and point; Data Core reaches `Planted` or `Completed` without invalid state.
- [x] Commit `docs: define single player baseline`.

## Task 2: Fix Zero Facility route selection and 3v3 stuck recovery

Files: `Source/BLA/Private/BLAAIController.cpp`, `Source/BLA/Public/BLAAIController.h`, `Source/BLA/Private/BLATacticalManager.cpp`, `Source/BLA/Public/BLATacticalManager.h`, and `Scripts/Editor/verify_task11_soak.py`.

- [x] Extend soak output with latest zone, tactical point, no-displacement ticks, and recovery count; reproduce missing LeftRoute or same-point congestion in 3v3 Data Core.
- [x] Give LeftRoute attack/flank points normal candidate scoring. If a point is reserved by a teammate or the requester has failed recovery twice, lower its score and choose a reachable point at least 300uu away. Keep selection deterministic.
- [x] Run `pwsh -File Scripts/run_verification.ps1 -Only verify_task11_pie -Tag singleplayer-routes`, then run elimination and Data Core 3v3 soak.
- [x] Require LeftRoute in both modes, lower stuck ticks than baseline, and no failed marker.
- [x] Commit `fix: balance offline bot routes and recovery`.

## Task 3: Stabilize Data Core objective rhythm

Files: `Source/BLA/Private/BLAObjectiveManager.cpp`, `Source/BLA/Public/BLAObjectiveManager.h`, `Source/BLA/Private/BLARoundManager.cpp`, `Source/BLA/Public/BLARoundManager.h`, and `Source/BLA/Private/BLAAllMVPFlowsTest.cpp`.

- [ ] Record Preparation, Carried, Planting, Planted, Uploading, and Completed ticks plus cancellation reasons.
- [ ] Ensure Preparation reset occurs once, upload timing starts only after Planted, and the configured 30-second upload rule is used without test-only rewriting.
- [ ] Preserve cancellation on movement, damage, death, leaving the zone, and round transition.
- [ ] Run `verify_task9_pie` and `verify_task12_pie`; require pickup -> plant -> upload/defuse -> round result without duplicate scoring or invalid state.
- [ ] Commit `fix: stabilize offline data core pacing`.

## Task 4: Harden the offline player flow

Files: `Source/BLA/Private/BLAUIManager.cpp`, `Source/BLA/Public/BLAUIManager.h`, `Source/BLA/Private/BLAGameInstance.cpp`, `Source/BLA/Public/BLAGameInstance.h`, `Scripts/Editor/build_task10_assets.py`, `Scripts/Editor/verify_task10_pie.py`, and `Source/BLA/Private/BLAUIFlowTest.cpp`.

- [ ] Add assertions for empty map config, invalid team size, repeated restart, results-to-menu, and settings save/restore.
- [ ] Guard `StartMatch`, `RestartMatch`, and `ReturnToMenu` against duplicate travel; clear old UI/round references and surface failures through `UBLADebugSubsystem` and menu error text.
- [ ] Run `verify_task10_pie` and `verify_task12_pie`; require all 18 configurations to start, complete, and return to menu.
- [ ] Commit `fix: harden offline player flow`.

## Task 5: Release regression and package

Files: `Scripts/run_verification.ps1`, `README.md`, `docs/builds/windows-mvp-smoke-test.md`, create `docs/builds/single-player-release-2026-09-15.md`.

- [ ] Run the full matrix and require `MATRIX_DONE checks=25 failed=0`.
- [ ] Build the Development Windows package and run `-BLASmokeTest`; require `HARNESS_RUN_COMPLETE configurations=18 failures=0`.
- [ ] Record date, UE version, commit, package path, results, known limitations, and LAN invariants in the release document.
- [ ] Rename the MVP `Online Roadmap` section to `LAN Extension Roadmap`, limited to Listen Server, server-authoritative match truth, AI fill, and disconnect-to-menu.
- [ ] Commit `release: complete offline single player milestone` and push `origin main`.

## Later LAN Extension

After this milestone passes, create `docs/superpowers/plans/2026-09-15-lan-listen-server.md`. It will cover LAN Listen Server only and will not add public matchmaking or account services.

