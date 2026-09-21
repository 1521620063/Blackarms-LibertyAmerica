# LAN Listen Server Packaged Smoke - 2026-09-15

Windows PC listen-server dual-process smoke for Zero Facility. Menu stays standalone; host travel is `MatchMapPath?listen` on port 7777 (`IpNetDriver`).

## Build

| Field | Value |
|-------|-------|
| Date | 2026-09-20 |
| Engine | Unreal Engine 5.8.2 at `D:\Epic Games\UE_5.8` |
| Configuration | Development, Win64 |
| Cook command | `& "D:\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="D:\dev\Blackarms-LibertyAmerica\BlackarmsLibertyAmerica.uproject" -noP4 -platform=Win64 -clientconfig=Development -cook -map=+/Game/BLA/Maps/Graybox/L_TestBootstrap+/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination+/Game/BLA/Maps/Final/L_BLA_ZeroFacility -build -stage -pak -archive -archivedirectory=D:\dev\BLA-Packaged -utf8output -nocompileeditor` |
| Cook tag | `lan-task7-hostleft` (`Scripts/run_lan_packaged_smoke.ps1` without `-SkipCook`) |
| Bootstrap exe | `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe` |
| Game binary | `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica\Binaries\Win64\BlackarmsLibertyAmerica.exe` (LastWriteTime 2026-09-20 20:58:06) |
| Confirmation tag | `lan-task7-final` (`-SkipCook` against the same package) |

## Process command lines

Host (pair 1, AutoStart):

```
D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe -BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5 -nullrhi -nosound -unattended -abslog=D:\dev\Blackarms-LibertyAmerica\Saved\Logs\LAN_HOST_lan-task7-final.log
```

Client (pair 1):

```
D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe -BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended -abslog=D:\dev\Blackarms-LibertyAmerica\Saved\Logs\LAN_CLIENT_lan-task7-final.log
```

Host (pair 2, no AutoStart; killed after join):

```
D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe -BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -nullrhi -nosound -unattended -abslog=D:\dev\Blackarms-LibertyAmerica\Saved\Logs\LAN_HOST2_lan-task7-final.log
```

Client (pair 2):

```
D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe -BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended -abslog=D:\dev\Blackarms-LibertyAmerica\Saved\Logs\LAN_CLIENT2_lan-task7-final.log
```

## Marker table (`tag=lan-task7-final`)

| Marker | Where | Result |
|--------|-------|--------|
| `BLA_ALL_MVP_FLOWS_SKIPPED reason=lan` | host + client | PASS |
| `BLA_LAN_PACKAGED_HOST_WAITING ip=192.168.1.3 port=7777` | host pair 1 `13:04:32.575` | PASS |
| `BLA_LAN_AUTOSTART_ARMED seconds=5.000000` | host pair 1 | PASS |
| `BLA_LAN_PACKAGED_CLIENT_JOINED` | client pair 1 `13:04:34.660` | PASS |
| `BLA_LAN_PACKAGED_TEAM team=Defenders` | client pair 1 `13:04:35.061` | PASS |
| `BLA_LAN_AUTOSTART_FIRE elapsed_real=5.004882 humans=2` | host pair 1 `13:04:37.580` | PASS (wall-clock 5s, not early join) |
| `BLA_LAN_PACKAGED_STARTED phase=1 humans=2 bots=2 total=4` | host pair 1 | PASS |
| `BLA_LAN_PACKAGED_STARTED phase=1 humans=2 bots=0 total=2` | client pair 1 | PASS |
| `BLA_LAN_PACKAGED_STATE net=2 phase=1 attack_score=0 defend_score=0 living_a=2 living_d=2` | host pair 1 | PASS |
| `BLA_LAN_PACKAGED_STATE net=3 phase=1 attack_score=0 defend_score=0 living_a=2 living_d=2` | client pair 1 | PASS (same RoundPhase and scores) |
| Host remains alive, no `BLA_LAN_PACKAGED_MENU` after client kill | host pair 1 | PASS |
| `BLA_LAN_PACKAGED_HOST_WAITING` / `BLA_LAN_PACKAGED_CLIENT_JOINED` | pair 2 | PASS |
| `FLOW_LAN_HOST_LEFT` after host process kill (`ConnectionTimeout` ~60s) | client pair 2 `13:05:55.400` | PASS |
| `BLA_LAN_PACKAGED_MENU` | client pair 2 `13:05:55.412` | PASS |
| Runner | `BLA_LAN_PACKAGED_SMOKE_OK tag=lan-task7-final` | PASS |

The same marker set also passed on `tag=lan-task7-hostleft` (full cook + dual-process). Pair 2 waits 90s because IpNetDriver is UDP: killing the host process does not RST, so a connected client surfaces `ConnectionTimeout` at the default 60s threshold and that is treated as `FLOW_LAN_HOST_LEFT`. Unconnected timeouts stay `CONNECT_FAILED`.

## Result

**PASS.** Packaged listen host and client joined Zero Facility, AutoStart fired at real 5s with two humans, replicated phase/scores matched, client leave did not dump the host to menu, and host leave returned the client to menu with `FLOW_LAN_HOST_LEFT`.
