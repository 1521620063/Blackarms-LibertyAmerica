# 单机完整版进度账本（2026-09-15）

计划：`docs/superpowers/plans/2026-09-15-single-player-complete.md`

## 范围裁决

- 本阶段只做单机版：菜单/HUD/结算流程、两种模式、Solo/2v2/3v3、AI 路线与卡点、Windows 打包冒烟。
- 局域网 Listen Server、服务端权威、会话、断线重连全部推迟到 `LAN 扩展路线`，本阶段不引入任何复制代码。
- 沿用现有架构：GameInstance 存选择与设置，GameMode/GameState/RoundManager/ObjectiveManager 存比赛真相，UI 只读。

## Task 1：单机基线（已完成）

- 命令：`pwsh -File Scripts/run_verification.ps1 -Tag singleplayer-baseline`
- 结果：`MATRIX_DONE checks=25 failed=0`、`MATRIX_OK`。
- 基线数据与验收阈值写入 `docs/testing/single-player-baseline-2026-09-15.md` 与 `docs/testing/mvp-test-matrix.md`。
- 提交：`docs: define single player baseline`。

## Task 2：Zero Facility 路线与卡点（已完成）

### 根因 1：战术点坐标全部丢失（严重）

`ABLATacticalPoint` 继承自 `AActor` 且没有根组件。UE 编辑器只在 Actor 有根组件时保存放置变换，
因此关卡里 9 个战术点全部序列化到世界原点 (0,0,0)，与它们设计的坐标无关。

后果：

- AI 的 `FindBestPoint` 只能挑到全部位于原点的点，所有 bot 挤向地图中心 → 这正是"左路从不使用"与
  "隘口卡死"的真实原因，而不是权重调参问题。
- 因为点在原点，导航测试此前"可达"，掩盖了问题。

修复：

- `Source/BLA/Private/BLATacticalPoint.cpp` 增加 `USceneComponent` 根组件，注释说明原因。
- 修复后 dump 验证：`Attack Route Point(-300,0)`、`Attack Left Route Point(-500,-600)`、
  `Attack Right Route Point(-500,600)`、`Flank Point(600,-760)`、`Cover Point(-700,600)`、
  `Guard Point(800,400)`、`Retreat Point(1100,-300)`、`Plant(450,-150)`、`Defuse(750,150)`。

### 根因 2：两个战术点原本嵌在墙体里

坐标恢复真实值后，导航测试立刻报 `tactical_unreachable`：

- `Flank Point` 原坐标 (-200,-760) 位于 Mid Wall South（x -220..-180，y -1000..-730）内部 → 移到侧翼走廊中心 (600,-760)。
- `Retreat Point` 原坐标 (1000,-600) 位于 Flank Wall North（x 150..1050，y -600..-560）内部 → 移到防守区 (1100,-300)。

### 根因 3：AI 从不预留战术点

`ABLATacticalManager::ReservePoint` 只被测试调用，AI 决策从不预留，因此多名突击手会一直选中同一个点。

修复：

- `ABLAAIController` 新增 `ReservedPoint`，`ResolveRoleDirective` 在解析前释放自己的旧预留、解析后预留新点，
  回合进入 Preparation 时统一释放。
- 车道分配改为按队伍内稳定序号：`PreferredLane = 队伍成员排序序号 % 3`，通过
  `FindBestPoint(..., PreferredLane)` 传入；左侧/中路/右侧各一个攻击点，3 人小队自然展开。

### 根因 4：生成器依赖 Slate tick，commandlet 下静默不保存

`build_task11_assets.py` 把"重建导航 → 设 Recast 为 Dynamic → 保存关卡"放在
`register_slate_post_tick_callback` 回调里，`-run=pythonscript` 没有 tick 回调，
脚本看起来成功但关卡从未保存。

修复：改为同步 `finish_build()`，同时保留可达性日志；
路线与战术点可达性由 `verify_task11_pie`（`BLA_MAP_NAVIGATION_OK`）保证。

### 新增验证

- `Scripts/Editor/verify_task11_contracts.py`：
  - 至少 3 个 `AttackPoint` 且分属 3 条不同车道；
  - 所有战术点坐标互不相同且不堆在原点（此前那条"全部落在原点"的缺陷现在会被直接测出来）。

### 证据

| 项目 | 修复前 | 修复后 |
|---|---|---|
| 战术点坐标 | 全部 (0,0,0) | 各自设计坐标 |
| `verify_task11_contracts` | `tactical=7`（未检查坐标） | `tactical=7 attack_points=3` |
| `verify_task11_pie` | `moved=1334.4` | `moved=1695.9 tactical=9 routes=4` |
| 3v3 浸泡路由 | 只有 CenterRoute/RightRoute | 两种模式都有 LeftRoute |

### 最终 3v3 soak（tag=singleplayer-routes）

| 模式 | First contact | Min moved | Stuck ticks | 基线 stuck | Routes | Recoveries |
|---|---|---:|---:|---:|---|---|
| Team Elimination | 137,1,1,1,1 | 908.1 | 832 | 21 | AttackSpawn,CenterRoute,DefenseSpawn,FlankZone,LeftRoute,MidCombatZone,ObjectiveZone,RightRoute | 30 |
| Data Core | 56,1,1,1,1 | 1661.4 | 1783 | 6756 | AttackSpawn,CenterRoute,DefenseSpawn,LeftRoute,MidCombatZone,ObjectiveZone | 40 |

- 两种模式都出现 LeftRoute；Elimination 还覆盖 RightRoute 与 FlankZone。
- Data Core stuck 从 6756 降到 1783，并观察到 AVAILABLE/CARRIED/DROPPED/PLANTING。
- Elimination stuck 从 21 升到 832：bot 不再挤在原点，开始走真实战术点，仍低于 2000 上限，且每次 stuck 都有 recovery point。
- 脚本化测试：BLA_DATACORE_OK（approach_lane=1 stuck_recover=1）、BLA_MAP_NAVIGATION_OK tactical=9、BLA_TASK11_CONTRACTS_OK attack_points=3。
- 提交：`fix: balance offline bot routes and recovery`。

## Task 3：Data Core 节奏（已完成）

根因是目标状态跟着下一帧走，而不是跟着回合阶段走：

- `StartMatch`/`StartPreparationPhase` 只改 `RoundPhase`，`ResetObjective()` 要等到下一 tick 的 `ObserveRoundPhase()` 才发生。测试如果在同一帧 pickup/plant，Preparation 的延迟 reset 会把已种下的核心清掉。
- `EndRound`/`EndMatch` 同样要等下一 tick 才 `CancelInteraction(RoundTransition)`，交互能跨过结算帧。
- `Planted` 当帧就开始扣 `UploadRemaining`；非 Combat 阶段也继续倒数，配置的 30 秒上传规则会被测试 workaround（`Tick(0.0f)` / `ResetObjective()` / 改写秒数）掩盖。
- 回合超时只看 `IsPlanted()`，`Uploading`/`Defusing` 时仍可能超时结束。

修复：

- `Configure`/`BeginPlay` 回写 `RoundManager->ObjectiveManager`。
- `StartPreparationPhase` 立刻 `HandlePreparationStart()`（Reset + `LastObservedPhase=Preparation`），保证 reset 一次且发生在 pickup 之前。
- `EndRound`/`EndMatch` 立刻 `HandleRoundEnding()` → `CancelInteraction(RoundTransition)`。
- `Planted` 当帧只切到 `Uploading` 并 return；`Uploading` 仅在 `RoundPhase==Combat` 时倒数。
- `IsUploadInProgress()` = Planted || Uploading || Defusing，超时跳过上传中的回合。
- `ResetObjective` 不清 tick 计数、`++ResetCount`，`CancelReasons` 不被 reset 清掉。
- soak 记录 reset/prep/carried/planting/planted/uploading/completed ticks 与 cancel reasons。
- Data Core 测试独立 `RunPacingChecks()`；AllMVPFlows 在 `StartCombatPhase()` 后 pickup/plant，使用真实 `PlantSeconds`/`UploadSeconds`，结果必须是 `ObjectiveUploaded`，重复 `EndRound` 必须失败。

证据（tag=`singleplayer-pacing-rebuild`，新编译 `UnrealEditor-BLA.dll` 16:14:26）：

- `verify_task9_pie`：`BLA_DATACORE_OK ... pacing=1 authority=manager`，`BLA_TASK9_PIE_DRIVER_OK ticks=300 datacore=ok`
- `verify_task12_pie`：`ALL_MVP_FLOWS_OK mode=1 size=3 difficulty=2`，`BLA_TASK12_PIE_DRIVER_OK`，`HARNESS_CONFIGURATION_STARTED`
- 本任务未重跑 3v3 soak。
- 提交：`fix: stabilize offline data core pacing`。

## Task 4：单机流程幂等与失败提示（已完成）

开始比赛、重开、回菜单原先没有 travel 互斥，失败也没有菜单错误文本：

- 空地图路径仍会发起 travel。
- 非法队伍人数被 Clamp 成 1/3，菜单看起来成功。
- 重复 StartMatch/ReturnToMenu 会再次 OpenLevel。
- ReturnToMenu 先切主菜单再 travel，比赛引用残留，Tick 继续刷 HUD。

修复：

- GameInstance 增加 `bTravelInProgress` 与 `LastFlowError`。空路径报 `FLOW_EMPTY_MAP`；travel 进行中或已在目标图报 `FLOW_DUPLICATE_TRAVEL`。`OnWorldChanged` 仅在 `NewWorld` 有效时清 flag。
- `ApplyTeamSize` / `RequestStartMatch` / `RequestReturnToMenu` / `RestartMatch` 改为返回 bool；非法人数不改 `SelectedTeamSize`。
- UIManager 失败时复制 GameInstance 错误到 `LastErrorText`。`ReturnToMenu` 先 travel，再 `ClearMatchReferences()`，再 `ShowScreen(MainMenu)`。
- Tick 在 `bStartInMainMenu`、主菜单或 travel 中不刷新比赛 UI。
- 菜单测试覆盖 empty map / invalid size / deferred StartMatch 成功与第二次失败；比赛测试覆盖 repeated restart（不改 `LastTravelRequest`）与 deferred ReturnToMenu。`bHarnessRequested` 时 skip match UIFlowTest，避免和 AllMVPFlows 抢 travel。

证据（tag=`singleplayer-flow`，新编译 `UnrealEditor-BLA.dll` 16:44:57）：

- `verify_task10_pie`：`BLA_UIFLOW_OK flow=menu ... empty_map=1 invalid_size=1 duplicate_start=1`，`BLA_UIFLOW_OK flow=match ... repeated_restart=1 results_to_menu=1`，`BLA_TASK10_PIE_DRIVER_OK menu=1 match=1 travel=roundtrip`
- `verify_task12_pie`：`ALL_MVP_FLOWS_OK mode=1 size=3 difficulty=2`，`HARNESS_CONFIGURATION_STARTED`，`BLA_TASK12_PIE_DRIVER_OK`，`MATRIX_DONE checks=1 failed=0` / `MATRIX_OK`
- 18 套配置冒烟属于 Task 5 的 `-BLASmokeTest`，本任务未跑。
- 提交：`fix: harden offline player flow`。

## 待办

- Task 5：全矩阵回归、Windows 打包冒烟、发布文档与 LAN 路线改写。
