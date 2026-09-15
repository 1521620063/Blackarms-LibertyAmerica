# LAN Listen Server 设计规格

- 日期：2026-09-15
- 状态：已确认设计，待用户审阅后写实现计划
- 项目目录：`D:\dev\Blackarms-LibertyAmerica`
- 目标平台：Windows PC LAN
- 引擎：Unreal Engine 5.8.2
- 前置里程碑：离线单机 `b53686b`（18 配置打包冒烟 `failures=0`）

## 1. 目标

在现有离线单机上增加 **Windows PC LAN Listen Server**。两人及以上可以在同一局域网用直连 IP 进入同一局 Zero Facility 比赛。主机是 Listen Server 上的玩家。空位用现有 AI 补齐。伤害、目标、分数、出生只在主机进程判定。

成功标准：一台机器创建房间，另一台（或同机第二个进程）填 IP 加入，选边后由主机开打，两边看到同一阶段和比分；加入者离开回菜单；主机离开则所有人回菜单。离线 18 配置矩阵保持 `failed=0`。

## 2. 已拍板决策

| 项 | 决定 |
|---|---|
| 加入方式 | 直连 IP，默认端口 `7777`。无房间列表、无 Steam session、无公网匹配 |
| 开局 | 短等待房。开打前加入；主机点 Start；之后拒绝中途加入 |
| 选边 | 等待房内自选 Attack / Defense。边满则拒绝 |
| 人数 | 沿用现有 Solo / 2v2 / 3v3。最多 `TeamSize * 2` 个真人。主机必玩 |
| 空位 | Start 时每边用现有 `SpawnBot()` 补到 `TeamSize`。允许一边全是 AI |
| 地图 / 模式 | 与离线相同：`MatchMapPath`（可玩默认 Zero Facility + `BP_BLAGameMode`），团队歼灭和数据核心 |
| 驱动 | `IpNetDriver` only。不加 Steam、OnlineSubsystem、账号 |
| 等待房位置 | 直接在比赛图 Listen，用 `Waiting` 阶段。不新增大厅图，不在主菜单 Listen |

## 3. 非目标

不做：

- Dedicated Server
- 账号、登录、好友、公网 online、匹配
- 局域网 session 发现 / 房间列表
- 中途加入、换主机、迁移 Listen Server
- 用户可改端口或选择 net driver
- 新地图、新武器、新 AI 路线
- 改 `ai_attacker_carry` 或把测试 Priority 当生产逻辑
- 复制 RoundManager / ObjectiveManager / TeamManager / AIController 内部状态

## 4. 架构

联网只发生在比赛图。主菜单保持单机。

```text
主菜单 (NM_Standalone)
  ├─ 单机开始  → RequestStartMatch()
  │                OpenLevel(MatchMapPath)
  │                NM_Standalone
  │                立即 InitializeMatch()   // 现有行为，不得改变
  │
  ├─ 创建 LAN  → RequestHostLANMatch()
  │                OpenLevel(MatchMapPath?listen)
  │                NM_ListenServer
  │                RoundPhase = Waiting
  │                显示等待房 + 本机 IPv4
  │
  └─ 加入 LAN  → RequestJoinLANMatch(IP)
                   ClientTravel(IP:7777)
                   NM_Client
                   只读复制的 GameState / PlayerState
                   等待房选边

Waiting 中：不 Possess 战斗 Pawn，不刷战斗 AI，不启动准备/战斗时钟。
Start 后：服务端分边、补 AI、InitializeMatch()/StartMatch()，之后拒绝新连接。
```

权威边界：

- 服务端（主机进程）：选边、开打、AI 补位、出生、伤害、目标、分数、回合、踢人。
- 客户端：输入、RPC 请求、复制状态、只读 UI。
- `UBLAGameInstance` 仍是唯一 travel 入口。UI 不直接 `OpenLevel`。

NetMode 是 LAN / 单机的分支条件，不另做隐藏“是否联机”开关：

- `NM_Standalone` → 现有离线立即开打
- `NM_ListenServer` → Waiting，等主机 Start
- `NM_Client` → Waiting/比赛 UI，不跑 GameMode 逻辑

## 5. 组件

### 5.1 `UBLAGameInstance`

新增：

- `RequestHostLANMatch()`：在 `MatchMapPath` 后追加 `?listen`，端口 `7777`。失败不离菜单。
- `RequestJoinLANMatch(const FString& Address)`：解析 `IP` 或 `IP:Port`（Port 缺省 7777），客户端 travel。非法地址不离菜单。
- `RequestLeaveLAN()`：断开 net 连接并 `TravelTo(MenuMapPath)`。

保持不变：

- `RequestStartMatch()` 仍然 `TravelTo(MatchMapPath)`，**禁止**附加 `?listen`。
- `bTravelInProgress` / `FLOW_DUPLICATE_TRAVEL` / `FLOW_EMPTY_MAP` / `FLOW_INVALID_TEAM_SIZE` 护栏。
- 菜单选择：Mode、TeamSize、Difficulty。这些选择只在主机创建时生效；加入者的本地选择不覆盖主机 `GameState`。

主机展示 IP：取第一块非回环 IPv4。同机测试允许加入 `127.0.0.1`。

### 5.2 `ABLAGameModeElimination`

Listen Server 权威。在 `BeginPlay` / `InitializeMatch` 分支：

- Standalone：保持当前立即 `InitializeMatch()`。
- ListenServer：写入复制后的 Mode / TeamSize / Difficulty / 阶段 `Waiting`，**不**刷 bot、**不** `StartMatch()`。
- Client：不初始化比赛逻辑。

额外职责：

- `PostLogin` / `Logout`：Waiting 且未满员才接受；开打或人满则踢回。
- `ServerStartLANMatch`（仅主机 PlayerController）：校验 Waiting → 处理 Neutral → 每边 `SpawnBot()` 补到 `TeamSize` → 走现有 `InitializeMatch()` / `StartMatch()`。
- 主机 `Logout` 或 world 拆除：拆局，客户端回菜单。
- 真人断线（开打后）：本回合该槽空着，不中途 Possess；下回合用 AI 补该边缺口。

AI 补位公式（Start 时）：

```text
AttackerBots = TeamSize - HumanAttackers
DefenderBots = TeamSize - HumanDefenders
Human* 计入已分边的真人。Neutral 先被强制分边后再计算。
结果必须满足 Attackers + Defenders == TeamSize * 2。
```

离线 Standalone 的补位保持现状（1 名本地玩家在 Attackers，补 `TeamSize-1` 名进攻 AI 和 `TeamSize` 名防守 AI），不要改这条离线假设。

### 5.3 `ABLARoundManager`

`EBLA_RoundPhase` 增加 `Waiting`。

- Waiting：不跑准备/战斗/目标/看门狗时钟，不结算回合。
- 离开 Waiting 之后的状态机与离线完全相同：Preparation → Combat → … → RoundResult / MatchResult。
- RoundManager、ObjectiveManager、TeamManager、TacticalManager 仍只存在于服务端。它们把阶段、比分、目标摘要写进 `ABLAGameState`，客户端不直接读这些 Actor。

### 5.4 `ABLAGameState`

所有比赛真相字段改为复制，至少包括：

- `MatchMode`、`RoundPhase`、`CurrentRound`
- `AttackersScore`、`DefendersScore`
- `AttackersTeamSize`、`DefendersTeamSize`
- `RoundTimeRemaining`
- `CurrentObjectiveState`
- 等待房名册摘要：每个槽位的显示名、队伍、是否主机（结构体数组，复制）

客户端 UI 只读 GameState / 本地 PlayerState / 本地 pawn 组件。

### 5.5 `ABLAPlayerState`

复制：

- `Team`
- `bIsLANHost`
- `Kills` / `Deaths` / `DamageDealt` / `ObjectiveContribution` / `DeathState`

选边只改服务端 PlayerState，再复制下去。

### 5.6 `ABLAPlayerController`

客户端只发请求：

- `ServerSetTeam(EBLA_Team)`：仅 Waiting；目标边真人 < `TeamSize` 才成功。
- `ServerStartLANMatch()`：仅 `bIsLANHost` 且 Waiting。
- 离开走 GameInstance `RequestLeaveLAN()`，不在 UI 里直接踢人。

Waiting 期间：不 Possess 战斗 Pawn，因此没有移动/开火。Start 后按边在现有出生点 Possess，再沿用现有输入。

开火、伤害、目标交互必须 `HasAuthority()` 或经由 server RPC 进入现有 `BLADamageResolver` / `BLAObjectiveManager`。禁止客户端本地改血、改目标、改比分。不新写一套伤害系统。

### 5.7 `ABLAUIManager`

继续只读，不判胜负，不补 AI。

菜单（Standalone）：

- 现有 Mode / TeamSize / Difficulty / 单机开始保留。
- 增加「创建 LAN」→ `RequestHostLANMatch()`。
- 增加「加入 LAN」：IP 输入框 + 加入按钮 → `RequestJoinLANMatch(IP)`。
- 失败文本继续绑定 `LastFlowError`。

比赛图 Waiting：

- 新增 EBLA_UIScreen::LANWaiting 与对应 widget。内容：名册、选边、主机 Start、本机 IP、离开。
- 非主机不显示 Start。
- 阶段离开 Waiting 后切回现有 MatchHUD。

### 5.8 配置

`Config/DefaultEngine.ini`：

- 使用默认 `IpNetDriver`
- `Port=7777`
- 不加 Steam / OnlineSubsystem 插件

## 6. 数据流

### 6.1 创建

1. 主机选 Mode / TeamSize / Difficulty。
2. `RequestHostLANMatch()`。
3. Listen 失败（端口占用等）→ 留在菜单，`FLOW_LAN_LISTEN_FAILED`。
4. 成功 → Zero Facility，`RoundPhase=Waiting`，主机 `PlayerState.Team=Attackers`（可改），`bIsLANHost=true`。
5. HUD 显示本机 IPv4 和 `7777`。

### 6.2 加入

1. 加入者填 IP（可选 `:port`）。
2. 空、非 IPv4、端口非数字 → `FLOW_LAN_INVALID_ADDRESS`，留在菜单。
3. 连接超时/拒绝 → `FLOW_LAN_CONNECT_FAILED`，留在或回到菜单。
4. 服务端若已开打 → 踢，`FLOW_LAN_JOIN_REJECTED_STARTED`。
5. 真人数量已达 `TeamSize*2` → 踢，`FLOW_LAN_JOIN_REJECTED_FULL`。
6. 成功 → `Team=Neutral`，等待房可见名册和规则（来自主机 GameState）。

### 6.3 选边

1. 点击 Attack / Defense → `ServerSetTeam`。
2. 非 Waiting、或该边真人已达 `TeamSize` → `FLOW_LAN_TEAM_FULL`，队伍不变。
3. 成功则复制 `PlayerState.Team`，双方名册更新。

### 6.4 Start

1. 仅主机可点。其他人调用 → `FLOW_LAN_NOT_HOST`。
2. 主机可以在只有自己时开打（其余全 AI）。不需要全员 Ready。
3. 仍为 Neutral 的真人：分到当前真人较少的边；相等则 Attackers。若该边已满则分到另一边。
4. 按 5.2 公式补 AI。
5. 现有 `StartMatch(ResolveRules(TeamSize))` 进入 Preparation。
6. 将 RoundPhase 设为 Preparation。之后凡 RoundPhase != Waiting 的 PostLogin 一律拒绝。不另加开始标志。

### 6.5 比赛中

- 回合、伤害、目标、分数只在服务端写入，再复制。
- 客户端 HUD 刷新来源与离线相同的只读结构，但数据必须来自复制字段，而不是本机 RoundManager 指针（客户端没有权威管理器）。
- 不改 bot 选路、carry、recovery 规则。

### 6.6 离开与断线

| 事件 | 行为 |
|---|---|
| 加入者点离开 | 断开，该客户端 `TravelTo` 菜单。Waiting：空位可再加入。已开打：本回合空槽，下回合 AI 补 |
| 加入者进程崩溃/断网 | 同上，该客户端本地回菜单；服务端 Logout 处理槽位 |
| 主机离开/崩溃 | Listen 消失。所有客户端 `FLOW_LAN_HOST_LEFT` 并回菜单。不换主机 |
| 比赛正常结束 | 现有 MatchResult → 各客户端可回菜单。主机回菜单则拆局 |

## 7. 错误码

沿用 `ReportFlowFailure` + `UBLADebugSubsystem`。UI 只展示 `LastFlowError`。

| 码 | 何时 |
|---|---|
| `FLOW_LAN_INVALID_ADDRESS` | 空地址、非 IPv4、坏端口 |
| `FLOW_LAN_CONNECT_FAILED` | 超时、拒绝、无法解析 |
| `FLOW_LAN_LISTEN_FAILED` | 主机无法绑定 `7777` |
| `FLOW_LAN_JOIN_REJECTED_FULL` | 真人已达 `TeamSize*2` |
| `FLOW_LAN_JOIN_REJECTED_STARTED` | 已离开 Waiting |
| `FLOW_LAN_TEAM_FULL` | 所选边真人已满 |
| `FLOW_LAN_NOT_HOST` | 非主机点 Start |
| `FLOW_LAN_HOST_LEFT` | 主机离开导致拆局 |

现有 `FLOW_EMPTY_MAP`、`FLOW_DUPLICATE_TRAVEL`、`FLOW_INVALID_TEAM_SIZE` 保持原意。

## 8. 测试

不同时开两个 `UnrealEditor-Cmd`。

### 8.1 离线回归（必须先绿）

现有 `Scripts/run_verification.ps1` 矩阵保持 `MATRIX_DONE checks=25 failed=0`。Standalone 路径零 `?listen`、零 LAN RPC。

### 8.2 编辑器自动化（一个编辑器进程）

Listen Server + 同进程客户端（PIE `NumberOfClients` / 自动化 net 模式），覆盖：

1. 主机进入 Waiting，阶段不是 Preparation。
2. 客户端加入后出现在名册，默认 Neutral。
3. 选边成功；边满时第二次选边失败。
4. 人满后第三个连接被拒。
5. Start 后 AI 数 = `TeamSize*2 - 真人数`，总战斗单位 = `TeamSize*2`。
6. Start 后新连接被拒。
7. 非主机 Start 失败，仍停在 Waiting。
8. 主机离开后客户端回到菜单。
9. Standalone `RequestStartMatch` 仍立即开打。

### 8.3 同机双进程冒烟（打包 exe）

1. 进程 A：创建 LAN，监听 `127.0.0.1:7777`。
2. 进程 B：加入 `127.0.0.1`，选 Defense。
3. 进程 A：Start。
4. 两边日志/复制状态：同一 `RoundPhase`、同一比分。
5. 进程 B 离开回菜单；进程 A 继续（AI 补位规则按 6.6）。
6. 再测主机先退出，客户端回菜单。

不测公网、不测跨网段、不测 Steam。双方均带 -nullrhi -nosound -unattended。命令行锁定为：
- 主机：-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5
- 客户端：-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders
BLALanAutoStart 是主机在 Waiting 满 N 秒后自动 Start，仅测试使用，Shipping 菜单不暴露。

## 9. 验收

同时满足才算本规格落地：

1. 离线矩阵不回退。
2. 直连 IP 可让 2 个进程进入同一局 Waiting。
3. 自选边；满员拒绝；主机 Start 后 AI 补齐。
4. 开打后拒绝加入。
5. 伤害/目标/分数/出生只在主机改，客户端 HUD 一致。
6. 加入者离开回菜单；主机离开所有人回菜单。
7. 无 Steam、无匹配、无 Dedicated Server、无新地图。

## 10. 实现约束

- 计划文件：批准本 spec 后写 `docs/superpowers/plans/2026-09-15-lan-listen-server.md`。
- 工作区：在当前仓库 `main` 实现，不给 UE 工程建 worktree。
- 提交：功能提交用常规前缀（`feat:` / `fix:` / `test:` / `docs:`）；用户明确要求时再推 `origin/main`。
- 中文进度：`docs/superpowers/sdd/` 下的 progress 用 Python 写，避免 PowerShell 吃掉反引号。
- Windows 上不要用系统 `python` stub；用 Codex primary runtime 的 `python.exe`。
