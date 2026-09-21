# LAN Listen Server 进度

计划：`docs/superpowers/plans/2026-09-15-lan-listen-server.md`

## Task 7

### PIE

- 命令：`pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -Tag lan-task7-s2size2 -TimeoutSeconds 420`
- 日志：`Saved/Logs/V_verify_lan_pie_lan-task7-s2size2.log`
- 结果：`BLA_LAN_PIE_DRIVER_OK sessions=3 markers=BLA_LAN_PIE_WAITING_OK,BLA_LAN_PIE_JOIN_OK,BLA_LAN_PIE_TEAM_OK,BLA_LAN_PIE_FULL_REJECT_OK,BLA_LAN_PIE_NOT_HOST_OK,BLA_LAN_PIE_HOST_LEFT_OK,BLA_LAN_PIE_START_OK,BLA_LAN_PIE_STARTED_REJECT_OK,BLA_LAN_PIE_CLIENT_DAMAGE_OK,BLA_LAN_PIE_STANDALONE_OK`

### 合约

- 命令：`pwsh -File Scripts/run_verification.ps1 -Only verify_lan_contracts -Tag lan-task7-hostleft-green`
- 日志：`Saved/Logs/V_verify_lan_contracts_lan-task7-hostleft-green.log`
- 结果：`BLA_LAN_CONTRACTS_OK cases=7 listen=1 offline_clean=1 autostart=1`
- 说明：编辑器世界没有 GameInstance 时，`RunAddressContracts` 回退到 CDO，并在合约内还原状态。

### 打包冒烟

- 完整构建：`pwsh -File Scripts/run_lan_packaged_smoke.ps1 -Tag lan-task7-hostleft`
- 复核：`pwsh -File Scripts/run_lan_packaged_smoke.ps1 -Tag lan-task7-confirm -SkipCook`
- 包：`D:/dev/BLA-Packaged/Windows/BlackarmsLibertyAmerica.exe`
- 日志：
  - `Saved/Logs/LAN_HOST_lan-task7-confirm.log`
  - `Saved/Logs/LAN_CLIENT_lan-task7-confirm.log`
  - `Saved/Logs/LAN_HOST2_lan-task7-confirm.log`
  - `Saved/Logs/LAN_CLIENT2_lan-task7-confirm.log`
- 关键结果：
  - `BLA_LAN_AUTOSTART_FIRE elapsed_real=5.0 humans=2`（真实 5 秒后开始）
  - `BLA_LAN_PACKAGED_STARTED` 主机/客户端分数一致
  - 杀掉客户端后主机仍在房间，未回菜单
  - 杀掉主机后客户端 60 秒 UDP 超时打出 `FLOW_LAN_HOST_LEFT`，然后回到菜单 `BLA_LAN_PACKAGED_MENU`
- 终线：`BLA_LAN_PACKAGED_SMOKE_OK tag=lan-task7-confirm`
- 详见：`docs/builds/lan-listen-server-smoke-2026-09-15.md`

### 离线回归

- 命令：`pwsh -File Scripts/run_verification.ps1 -Tag lan-task7-offline`
- 结果：`MATRIX_DONE checks=25 failed=0`
- 终线：`MATRIX_OK`
- 默认矩阵仍是 25 项，LAN 只在 `-Only verify_lan_contracts` / `-Only verify_lan_pie` 时运行。

### 结论

Task 7 完成：PIE、合约、打包双进程冒烟、离线 25 项矩阵全部通过。README 已替换为真实的 LAN Listen Server 说明。
