# UE5 Tactical FPS MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Windows UE5 offline AI team FPS MVP supporting Solo, 2v2, and 3v3 with Team Elimination and Data Core Attack/Defense on one modular graybox map.

**Architecture:** Use a data-driven Blueprint-first architecture. GameMode/GameState/PlayerState own match truth; shared character components own health, weapons, interaction, and objective capabilities; AIController/Behavior Trees execute bot decisions; UMG only displays state. Keep all core rules out of Level Blueprint and preserve clean interfaces for later server-authoritative networking.

**Tech Stack:** Unreal Engine 5, Blueprint, UMG, Enhanced Input, AI Controller, Behavior Tree, Blackboard, AI Perception, NavMesh, Data Assets/Data Tables, Functional Tests, Windows Packaging.

**Spec:** `D:\dev\fps-game\docs\superpowers\specs\2026-09-14-ue5-tactical-fps-design.md`

## Global Constraints

- Windows PC; first release is offline AI versus player/AI, not online multiplayer.
- 3v3 is the polished scale; Solo and 2v2 use configuration, not duplicate gameplay systems.
- Modes are Team Elimination and Data Core Attack/Defense.
- Low-poly stylized sci-fi industrial art; one indoor modular graybox map.
- Weapons are Energy Pistol, Pulse Rifle, and Scatter Gun; Light/Heavy Armor; hitscan only.
- No grenades, projectile simulation, complex economy, hero skills, vehicles, open world, or ranked/account systems in the MVP.
- Core truth stays in GameMode/GameState/PlayerState and managers; UI is read-only.
- Use Data Assets/Data Tables for rules, weapons, AI difficulty, maps, and tactical points.
- Every task ends with an editor/PIE or automated test cycle.
- Do not add plugins, perform broad renames, or refactor unrelated assets.

## Asset Ownership Map

Create assets only in their owning folders: `Content/FPS/Blueprints/Core`, `Characters`, `Weapons`, `AI`, `Objectives`, `Teams`, `Rounds`, `Maps`, `UI`; `Content/FPS/AI/{BehaviorTrees,Blackboards,Tasks,Services,Decorators}`; `Content/FPS/Data/{Weapons,AI,Rules,Maps,UI}`; `Content/FPS/Maps/{Graybox,Final}`; `Content/FPS/Tests`. Use prefixes `BP_`, `WBP_`, `BT_`, `BB_`, `BTT_`, `BTS_`, `BPD_`, `DA_`, `DT_`, `IA_`, `IMC_`, `M_`, `MI_`, `SFX_`, `VFX_`.

---

### Task 1: Bootstrap the UE5 project and repository

**Files:** Create `D:\dev\fps-game\FPS.uproject`, `README.md`, `.gitignore`, the `Content/FPS/` folder tree, and `Content/FPS/Maps/Graybox/L_TestBootstrap`.

**Interfaces:** Produces a runnable Blueprint UE5 project, default test map, exact asset ownership tree, and documented UE5 version.

- [x] Create a Games > First Person Blueprint project at `D:\dev\fps-game`, Desktop/Windows target, Enhanced Input enabled, default map `L_TestBootstrap`.
- [x] Create the exact folders in the Asset Ownership Map; do not create gameplay `Misc` folders.
- [x] Configure Windows target and record the exact engine version in `README.md`.
- [x] Create `.gitignore` excluding `Binaries/`, `DerivedDataCache/`, `Intermediate/`, `Saved/`, `.vs/`, and generated IDE files. Document opening and the Level Blueprint rule.
- [x] Open the project, load the bootstrap map, press Play, move the template character, stop PIE, close/reopen, and confirm no load errors.
- [x] If Git is initialized, commit `chore: bootstrap UE5 FPS project`; otherwise initialize Git before implementation and make that commit.

---

### Task 2: Define gameplay contracts and configuration data

**Files:** Create `BP_FPSGameplayTypes`, `BPI_FPSCombatant`, `BPI_FPSInteractable`, `BPI_FPSObjectiveCarrier`; rule assets `DA_FPSMatchRules_Solo`, `_2v2`, `_3v3`; difficulty assets `DA_FPSBotDifficulty_Easy`, `_Normal`, `_Hard`; test actor `BP_FPSGameplayDataValidator`.

**Interfaces:** Produces the exact enums, structs, interfaces, and data assets consumed by all later tasks.

Enums:

```text
EFPS_Team = Attackers, Defenders, Neutral
EFPS_MatchMode = TeamElimination, DataCoreAttackDefense
EFPS_RoundPhase = Loading, Preparation, Combat, ObjectiveUpload, RoundResult, MatchResult
EFPS_BotRole = Assault, Support, Defender
EFPS_WeaponType = EnergyPistol, PulseRifle, ScatterGun
EFPS_ObjectiveState = None, Available, Carried, Dropped, Planting, Planted, Uploading, Defusing, Defused, Completed
EFPS_DeathState = Alive, Dead, Spectating
```

`FFPSMatchRules`: `TeamSize`, `PreparationSeconds`, `CombatSeconds`, `PlantSeconds`, `DefuseSeconds`, `UploadSeconds`, `RoundsToWin`, `SwitchSidesAfterRound`, `ObjectiveCount`. Use Solo 1/60/3, 2v2 2/75/4, 3v3 3/90/5; preparation 15, plant/defuse 5, upload 30, objective count 1.

`FFPSBotDifficulty`: `VisionReactionSeconds`, `AimErrorDegrees`, `FireDelaySeconds`, `HearingRadius`, `SearchSeconds`, `TacticalExecutionProbability`, `TeamAssistProbability`. Hard must retain non-zero error and no hidden information.

Interfaces:

```text
BPI_FPSCombatant: GetTeam() -> EFPS_Team; GetIsAlive() -> Boolean;
ApplyCombatDamage(DamageAmount: Float, DamageLocation: Name, InstigatorActor: Actor) -> Boolean;
GetCombatantWorldLocation() -> Vector
BPI_FPSInteractable: CanInteract(Interactor: Actor) -> Boolean;
BeginInteraction(Interactor: Actor) -> Boolean; CancelInteraction(Interactor: Actor);
CompleteInteraction(Interactor: Actor) -> Boolean
BPI_FPSObjectiveCarrier: HasObjectiveCore() -> Boolean;
GiveObjectiveCore(CoreActor: Actor) -> Boolean; RemoveObjectiveCore() -> Actor
```

- [x] Create enums, structs, interfaces, and six data assets with the exact names/fields.
- [x] Create the validator; fail if team size or rounds are below 1, times are negative, or MVP objective count is not 1.
- [x] Place the validator in the bootstrap map, run PIE, and confirm the Output Log reports every asset with no failure.
- [x] Commit `feat: define FPS gameplay data contracts`.

---

### Task 3: Build the shared character, input, health, and death foundation

**Files:** Create `BP_FPSCharacterBase`, `BP_FPSPlayerCharacter`, `BP_FPSBotCharacter`, `BP_FPSHealthComponent`, `BP_FPSInteractionComponent`, `BP_FPSPlayerController`, `BP_FPSPlayerState`; input assets `IA_Move`, `IA_Look`, `IA_Jump`, `IA_Fire`, `IA_Reload`, `IA_SwitchPrimary`, `IA_SwitchSecondary`, `IA_Command`, `IMC_FPSPlayer`.

**Interfaces:** Consumes Task 2 contracts; produces a shared combatant with team/alive/damage/reset/movement/interaction behavior.

`BP_FPSHealthComponent` contract:

```text
MaxHealth=100; CurrentHealth; ArmorValue; IsDead
ApplyDamage(Amount, DamageLocation, InstigatorActor) -> Boolean
ResetHealth(); HandleDeath()
```

- [x] Map WASD, mouse X/Y, Space, left mouse, R, 1, 2, and Q to the input assets.
- [x] Implement clamped damage, `OnHealthChanged`, `OnDeath`, one-shot death protection, reset to full health, and rejection after death.
- [x] Put movement, camera, health, and interaction on `BP_FPSCharacterBase`; implement `BPI_FPSCombatant`. On death disable combat movement/collision; reset belongs to `RoundManager`.
- [x] Derive player and bot characters; player input belongs to controller/character, bot decisions to AIController.
- [x] Store Team, DeathState, Kills, Deaths, DamageDealt, and ObjectiveContribution in `BP_FPSPlayerState`.
- [x] Verify movement/look/jump, 100 health, one death event, disabled movement after death, and reset to full health.
- [x] Commit `feat: add shared character and health foundation`.

---

### Task 4: Implement data-driven hitscan weapons

**Files:** Create `DA_FPSWeapon_EnergyPistol`, `DA_FPSWeapon_PulseRifle`, `DA_FPSWeapon_ScatterGun`, `BP_FPSWeaponBase`, `BP_FPSWeaponComponent`, `BP_FPSWeapon_EnergyPistol`, `BP_FPSWeapon_PulseRifle`, `BP_FPSWeapon_ScatterGun`, `BP_FPSDamageResolver`, `BP_FPSHitFeedbackComponent`, `BP_FPSWeaponTestActor`.

**Interfaces:** Consumes Task 3 input/health; produces `EquipWeapon`, `FireWeapon`, `ReloadWeapon`, `SwitchWeapon`, `GetCurrentAmmo`, `CanFire`.

Weapon data: `WeaponType`, `BaseDamage`, `WeakPointMultiplier=2.0`, `BodyMultiplier=1.0`, `LimbMultiplier=0.75`, `RoundsPerMinute`, `MagazineCapacity`, `ReserveAmmo`, `ReloadSeconds`, `MaxRange`, `RangeFalloff`, `AimSpreadDegrees`, `AIPreferredRange`.

- [x] Create three assets with magazines 12, 24, and 6 for pistol, rifle, and scatter gun.
- [x] Implement ammo, reserve ammo, cooldown, reload, switching, and fire guards for dead/reloading/cooldown/empty.
- [x] Trace from player camera or bot aim origin; resolve actor/zone/falloff/armor in `BP_FPSDamageResolver`; route damage through health only.
- [x] Use one trace for pistol/rifle and fixed deterministic multi-trace spread for scatter gun; never spawn projectile actors.
- [x] Add placeholder muzzle, debug line, hit marker, hit sound, and hit/kill feedback without match-rule logic.
- [x] Test all weapons, ammo/reload/cooldown, body/weak-point/limb multipliers, armor, and no damage after death.
- [x] Commit `feat: add data-driven hitscan weapons`.

---

### Task 5: Implement teams, GameMode/GameState, rounds, and reset

**Files:** Create `BP_FPSGameInstance`, `BP_FPSGameMode`, `BP_FPSGameState`, `BP_FPSTeamManager`, `BP_FPSRoundManager`, `BP_FPSRoundResultData`, `BP_FPSSpawnPoint`, `BP_FPSRoundTestActor`.

**Interfaces:** Consumes Tasks 2–4; produces match state and round events for AI, objectives, and UI.

`BP_FPSGameState` fields: `MatchMode`, `RoundPhase`, `CurrentRound`, `AttackersScore`, `DefendersScore`, `AttackersTeamSize`, `DefendersTeamSize`, `RoundTimeRemaining`, `CurrentObjectiveState`.

`BP_FPSRoundManager` functions: `StartMatch(Rules)`, `StartPreparationPhase()`, `StartCombatPhase()`, `EndRound(Winner, Reason)`, `SwitchSidesIfRequired()`, `StartNextRound()`, `EndMatch(Winner)`, `ResetAllCombatants()`.

- [ ] Store selected mode/rules/difficulty/team size in GameInstance; store live state only in GameState.
- [ ] Implement team registration, unregistration, living count, team members, opposing team, and configured slots.
- [ ] Implement spawn-point team/zone/reservation data and safe fallback selection.
- [ ] Implement `Loading -> Preparation -> Combat -> RoundResult` and `MatchResult` at `RoundsToWin`; one timer belongs to RoundManager.
- [ ] On death, end elimination rounds once when a side reaches zero; on timeout compare living count, then remaining health, then use overtime.
- [ ] Reset health, ammo, objective, reservations, sides, and combatants idempotently; no duplicate spawns or team entries.
- [ ] Test 1v1: kill either side, verify one result, one score increment, reset, and match result after three wins.
- [ ] Commit `feat: add teams and round match framework`.

---

### Task 6: Build AI perception, navigation, tactical points, and elimination behavior

**Files:** Create `BP_FPSAIController`, `BP_FPSBotPerception`, `BP_FPSTacticalManager`, `BP_FPSTacticalPoint`, `BTT_FPSMoveToTacticalPoint`, `BTT_FPSAimAndFire`, `BTT_FPSFindCover`, `BTT_FPSSearchLastKnownPosition`, `BTS_FPSUpdateTarget`, `BTS_FPSCheckStuck`, `BPD_FPSHasLiveTarget`, `BB_FPSBot`, `BT_FPSBotElimination`, `BP_FPSAITestFixture`.

**Interfaces:** Consumes bot, team, weapon, difficulty, and map systems; produces stable bots that navigate, perceive, fight, seek cover, and recover.

Blackboard keys: `TargetActor`, `LastKnownTargetLocation`, `CurrentTacticalPoint`, `CurrentTask`, `Team`, `BotRole`, `HasObjectiveCore`, `IsUnderFire`, `IsStuck`.

- [ ] Implement tactical point type/team/role/priority/occupied/objective properties for `CoverPoint`, `GuardPoint`, `AttackPoint`, `FlankPoint`, `RetreatPoint`, `PlantPoint`, and `DefusePoint`.
- [ ] Add sight, hearing, and damage stimuli; reject actors on the same team; store last known location.
- [ ] Implement move failure, stuck detection using displacement over an interval, and recovery to the nearest reachable point.
- [ ] Implement aim/fire guards for alive state, target validity, cooldown, line of sight, and preferred range; call WeaponComponent rather than duplicating damage.
- [ ] Build priority tree: dead/wait, live target combat or cover, stuck recovery, assigned point movement, fallback patrol/hold.
- [ ] Apply difficulty parameters with non-zero aim error and perception limits.
- [ ] Test two opposing bots reaching points, seeing/hearing/damaging each other, firing, seeking cover, searching last location, and recovering from a blocked point.
- [ ] Commit `feat: add first bot perception and combat behavior`.

---

### Task 7: Complete the 1v1 Team Elimination vertical slice

**Files:** Create `L_FPS_1v1_Elimination`, `BP_FPSGameMode_Elimination`, `FT_FPS_1v1_Elimination`; modify GameState, RoundManager, and elimination behavior tree.

**Interfaces:** Consumes Tasks 1–6; produces the first complete playable match loop and permanent regression fixture.

- [ ] Build a small room with protected team spawn areas, three cover objects, a central combat area, and complete NavMesh.
- [ ] Configure Team Elimination, Solo rules, one player attacker, one defender bot, and match start after registration.
- [ ] Attach weapon components and bind fire/reload/switch inputs.
- [ ] Play a win and a loss, confirm next-round reset, score change, and match result at three wins.
- [ ] Functional test must assert match start, registration, preparation/combat phases, single round end, score increment, idempotent reset, and MatchResult.
- [ ] Commit `feat: complete 1v1 elimination vertical slice`.

---

### Task 8: Expand to 3v3, roles, team orders, and spectator mode

**Files:** Create `BP_FPSTeamOrderManager`, `BP_FPSRoleAssignment`, `BTT_FPSFollowPlayer`, `BTT_FPSGuardPoint`, `BTT_FPSAttackRoute`, `WBP_FPSSpectator`, `FT_FPS_3v3_Elimination`; modify controller and elimination tree.

**Interfaces:** Consumes the vertical slice and command input; produces configurable Solo/2v2/3v3 population, roles, orders, and observation.

- [ ] Define `EFPS_TeamOrder = FollowPlayer, HoldHere, AttackTarget, Retreat`; store current order, issuer, target location, and phase expiry; clear at reset.
- [ ] Assign Assault, Support, Defender deterministically to available bots; Solo/2v2 use the first available roles.
- [ ] Make Assault choose AttackPoint, Support follow player or nearest Assault, Defender choose GuardPoint; after player death follow highest-priority living teammate.
- [ ] Route four keyboard/selector commands through TeamOrderManager; commands may not directly move or damage bots.
- [ ] After player death, cycle previous/next living friendly bots; when none live, use a fixed map camera until RoundResult.
- [ ] Run Solo, 2v2, and 3v3, force deaths in different orders, and verify no duplicate registration, role assignment, order reset, or spectator enemy view.
- [ ] Run full 3v3 test to five wins and commit `feat: add configurable team sizes and bot roles`.

---

### Task 9: Implement Data Core Attack/Defense

**Files:** Create `BP_FPSDataCore`, `BP_FPSObjectiveZone`, `BP_FPSObjectiveManager`, `BTT_FPSSeekDataCore`, `BTT_FPSCarryDataCore`, `BTT_FPSPlantDataCore`, `BTT_FPSDefendObjective`, `BTT_FPSDefuseDataCore`, `BT_FPSBotObjective`, `FT_FPS_DataCore`.

**Interfaces:** Consumes round, team, interaction, perception, and tactical systems; produces objective mode without duplicating round rules.

- [ ] Implement objective states `Available`, `Carried`, `Dropped`, `Planting`, `Planted`, `Uploading`, `Defusing`, `Defused`, and `Completed`; drop on carrier death and reset outside valid area.
- [ ] Allow attackers to plant and defenders to defuse only after plant; use 5 seconds for plant/defuse and 30 seconds for upload.
- [ ] Cancel interaction on movement, damage, death, leaving zone, or round transition; only ObjectiveManager may complete the objective.
- [ ] Route elimination, timeout, defuse, and upload wins through `RoundManager.EndRound` with explicit reasons.
- [ ] Build objective tree: attackers seek/carry/plant/defend; defenders guard/intercept/investigate/defuse.
- [ ] Test pickup, drop, repickup, plant interruption, plant, defuse interruption, defuse, upload, timeout, and reset.
- [ ] Commit `feat: add data core attack and defense mode`.

---

### Task 10: Build menus, HUD, settings, results, and player flow

**Files:** Create `WBP_FPSMainMenu`, `WBP_FPSModeSelect`, `WBP_FPSSettings`, `WBP_FPSMatchHUD`, `WBP_FPSTeamStatus`, `WBP_FPSWeaponStatus`, `WBP_FPSObjectiveStatus`, `WBP_FPSRoundResult`, `WBP_FPSMatchResult`, `WBP_FPSInteractionPrompt`, `WBP_FPSCommandSelector`, `BP_FPSUIManager`, `FT_FPS_UIFlow`.

**Interfaces:** Reads GameInstance selections, GameState, PlayerState, weapon/health/objective components, and controller events; never decides gameplay results.

- [ ] Main menu: Start, Mode, Settings, Exit. Mode: Team Elimination/Data Core; scale: Solo/2v2/3v3; difficulty: Easy/Normal/Hard.
- [ ] Save selected mode/rules/team size/difficulty to GameInstance, then load the graybox map.
- [ ] HUD: health, armor, weapon/ammo, score, round, timer, side, teammate states, enemy count, crosshair, hit feedback, objective state.
- [ ] Results: winner, reason, kills, damage, objective contribution, score, restart, return to menu; restart calls GameMode/GameInstance entry point.
- [ ] Settings: mouse sensitivity, FOV, resolution/fullscreen, master/music/effects volume, subtitles, crosshair, color assistance; save through a dedicated save object.
- [ ] Test menu selections, both modes, all scales/difficulties, HUD refresh, round result, spectator, match result, restart, and return to menu.
- [ ] Commit `feat: add menus HUD spectator and results flow`.

---

### Task 11: Build and validate the Zero Facility graybox map

**Files:** Create `L_FPS_ZeroFacility`, `BP_FPSMapZone`, `BP_FPSMapConfig`, `DA_FPSMapConfig_ZeroFacility`, `FT_FPS_MapNavigation`.

**Interfaces:** Consumes spawn/tactical/objective/AI systems; produces one map playable in both modes and all MVP scales.

- [ ] Build AttackSpawn, LeftRoute, CenterRoute, RightRoute, MidCombatZone, ObjectiveZone, FlankZone, DefenseSpawn with cubes/BSP only.
- [ ] Add narrow left, direct central, wider right, two target entries, one flank, low/high/directional cover, 3–5 spawn points per team, and all tactical point types.
- [ ] Build NavMesh over all routes, covers, target areas, and tactical points; remove unrecoverable corners and door traps.
- [ ] Store supported modes/scales and actor references in `DA_FPSMapConfig_ZeroFacility`; GameMode loads this asset rather than arbitrary name searches.
- [ ] Navigation test checks route reachability, role-point reachability, no spawn-to-spawn direct sight, valid objective interactions, and no spawn overlap.
- [ ] Play five matches per mode at Solo/2v2/3v3; record first contact time, route usage, objective success, and choke/spawn issues in `README.md`.
- [ ] Commit `feat: add zero facility modular graybox map`.

---

### Task 12: Add regression, diagnostics, recovery, and Windows packaging

**Files:** Create `FT_FPS_AllMVPFlows`, `BP_FPSTestHarness`, `BP_FPSDebugSubsystem`, `docs/testing/mvp-test-matrix.md`, `docs/builds/windows-mvp-smoke-test.md`; modify managers only to emit recovery diagnostics.

**Interfaces:** Consumes all MVP systems; produces repeatable regression coverage and safe recovery.

- [ ] Test harness selects mode, scale, difficulty, map, starts matches, waits for phases, forces damage/objective actions, and reports pass/fail; exclude it from shipping builds.
- [ ] AI stuck recovery: recalculate to nearest reachable point; after two failures in one round use team safe fallback and emit `AI_STUCK_RECOVERED` with bot/point.
- [ ] Core recovery: reset outside-map core to nearest valid location and emit `OBJECTIVE_CORE_RESET`; if none exists, end with `ObjectiveInvalidState` and map name.
- [ ] Round watchdog: end overlong phases, emit `ROUND_WATCHDOG_EXPIRED`, and guard duplicate score increments with `IsRoundEnding`.
- [ ] Spawn recovery tries remaining team points then safe fallback and emits `SPAWN_FALLBACK_USED` with rejection reason.
- [ ] Run all flows across both modes, Solo/2v2/3v3, and all difficulties; run five unattended 3v3 matches per mode; inspect recovery logs.
- [ ] Replace placeholders one category at a time only after graybox tests pass: walls/floors, cover, weapons, bot, lights/terminals, VFX/audio. Do not change gameplay rules.
- [ ] Package a Development Windows build; launch it, start both modes, run all scales, complete a round, restart, and return to menu. Record date, UE5 version, output path, scenarios, and result in the smoke-test file.
- [ ] Commit `test: add MVP regression and recovery diagnostics`, then `release: package Windows FPS MVP` after the packaged smoke test passes.

## Deferred Online Roadmap

Do not execute in the MVP. After Task 12 passes: replicate GameState/PlayerState/weapon/objective state, move damage/objective/score/spawn decisions to server authority, add sessions and AI replacement, create a dedicated server target, handle disconnects and synchronized spectator mode, then rerun the same functional matrix with one real client and AI fill.

## Execution Rules

- Implement tasks in order; later tasks may consume only interfaces from earlier tasks.
- Run the task-specific test before starting the next task.
- If an interface or spec conflict appears, update the spec and plan before unrelated implementation.
- Keep commits task-scoped and include the exact test result.
- Use a fresh AI prompt per task with allowed paths, prohibited changes, expected behavior, and test steps.
- Do not claim completion from editor appearance alone; require a passing PIE/functional/package test.
