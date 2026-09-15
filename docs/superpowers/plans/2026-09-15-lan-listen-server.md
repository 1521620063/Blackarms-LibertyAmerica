# LAN Listen Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows PC LAN Listen Server so a host and clients can join Zero Facility by IP, pick teams in a Waiting room, start with AI fill, and keep match truth server-authoritative.

**Architecture:** The menu stays standalone. Host travel uses `MatchMapPath?listen` on port 7777 with `IpNetDriver`. `ABLAGameModeElimination` enters `Waiting` on listen, accepts IP joins, applies team RPCs, then starts the existing match pipeline with AI filling empty slots. `GameState`/`PlayerState` replicate; RoundManager/ObjectiveManager/AI stay server-only. Offline `RequestStartMatch()` remains a local `OpenLevel` with no `?listen`.

**Tech Stack:** Unreal Engine 5.8.2, C++, UMG, `IpNetDriver`, existing BLA GameMode/GameState/RoundManager, editor Python PIE drivers, packaged Win64 Development exe.

**Spec:** `docs/superpowers/specs/2026-09-15-lan-listen-server-design.md`

## Global Constraints

- Windows PC LAN only. No Steam, OnlineSubsystem, accounts, matchmaking, public online, or Dedicated Server.
- Keep Zero Facility and `BP_BLAGameMode` as the playable defaults. LAN uses the same `UBLAGameInstance::MatchMapPath` as offline start.
- Direct IP join, default port `7777`, `IpNetDriver` only. Port is not user-configurable.
- Short waiting room on the match map (`EBLA_RoundPhase::Waiting`). No lobby map. No mid-match join.
- Host always plays. Players pick Attack/Defense. Max humans = `TeamSize * 2`. Empty slots filled with existing `SpawnBot()` at Start.
- Waiting does not possess a combat pawn and does not spawn combat AI.
- Disconnect: joiner returns to menu; host leave tears the session down for everyone.
- After Start, a disconnected human slot stays empty for the current round and is AI-filled next round. No mid-round Possess-replace.
- Gameplay truth stays in GameMode/GameState/RoundManager/ObjectiveManager. UI remains read-only.
- Do not change `ai_attacker_carry` or treat test Priority as production logic.
- Do not run two `UnrealEditor-Cmd` processes. Do not create a git worktree for this UE project.
- Existing 25-check offline matrix must stay `MATRIX_DONE checks=25 failed=0`.
- Append `Waiting` at the **end** of `EBLA_RoundPhase` so existing ordinals stay stable.
- Write `docs/superpowers/sdd/**/progress.md` with the Codex primary-runtime Python, not Windows `python` or PowerShell here-strings.
- Commit on `main` with conventional prefixes. Push only when the user explicitly asks.

## File Map

Create:
- `Source/BLA/Public/BLALanStatics.h`
- `Source/BLA/Private/BLALanStatics.cpp`
- `Source/BLA/Public/BLALanFlowTest.h`
- `Source/BLA/Private/BLALanFlowTest.cpp`
- `Source/BLA/Private/BLAGameState.cpp`
- `Source/BLA/Private/BLAPlayerState.cpp`
- `Scripts/Editor/verify_lan_contracts.py`
- `Scripts/Editor/verify_lan_pie.py`
- `Scripts/run_lan_packaged_smoke.ps1`
- `docs/builds/lan-listen-server-smoke-2026-09-15.md`
- `docs/superpowers/sdd/2026-09-15-lan-listen-server/progress.md`

Modify:
- `Source/BLA/Public/BLAGameplayTypes.h` — `Waiting` enum, `FBLALanRosterEntry`
- `Source/BLA/Public/BLAGameInstance.h`, `Source/BLA/Private/BLAGameInstance.cpp`
- `Source/BLA/Public/BLAGameState.h`, `Source/BLA/Public/BLAPlayerState.h`
- `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`
- `Source/BLA/Public/BLAPlayerController.h`, `Source/BLA/Private/BLAPlayerController.cpp`
- `Source/BLA/Public/BLARoundManager.h`, `Source/BLA/Private/BLARoundManager.cpp`
- `Source/BLA/Public/BLAUIManager.h`, `Source/BLA/Private/BLAUIManager.cpp`
- `Source/BLA/Public/BLAHealthComponent.h`, `Source/BLA/Private/BLAHealthComponent.cpp`
- `Source/BLA/Public/BLACharacterBase.h`, `Source/BLA/Private/BLACharacterBase.cpp`
- `Source/BLA/Public/BLAWeaponComponent.h`, `Source/BLA/Private/BLAWeaponComponent.cpp`
- `Source/BLA/Private/BLATestHarness.cpp` — unattended LAN flags must not start the 18-config smoke
- `Config/DefaultEngine.ini`
- `Source/BLA/BLA.Build.cs` — add `Sockets` for `GetAdvertiseIPv4`
- `Scripts/Editor/verify_task2_contracts.py` — allow `WAITING`
- `Scripts/Editor/build_task10_assets.py` — `WBP_BLALANWaiting`
- `Scripts/run_verification.ps1` — add LAN checks as extra `-Only` targets, do not change the default 25-check matrix count
- `README.md`

---

### Task 1: LAN address parsing and travel entry

**Files:**
- Create: `Source/BLA/Public/BLALanStatics.h`, `Source/BLA/Private/BLALanStatics.cpp`, `Source/BLA/Public/BLALanFlowTest.h`, `Source/BLA/Private/BLALanFlowTest.cpp`, `Scripts/Editor/verify_lan_contracts.py`
- Modify: `Source/BLA/Public/BLAGameInstance.h`, `Source/BLA/Private/BLAGameInstance.cpp`, `Source/BLA/BLA.Build.cs`, `Config/DefaultEngine.ini`, `Scripts/Editor/build_task10_assets.py` (place `BP_BLALanFlowTest` in `/Game/BLA/Tests` and add it to `L_TestBootstrap` if the other flow tests live there)
- Test: `Scripts/Editor/verify_lan_contracts.py`

**Interfaces:**
- Consumes: existing `UBLAGameInstance::TravelTo`, `MatchMapPath`, `MenuMapPath`, `ReportFlowFailure`, `bTravelInProgress`
- Produces:
  - `struct FBLALanAddress { FString Host; int32 Port = 7777; bool bValid = false; };`
  - `static bool UBLALanStatics::ParseLANAddress(const FString& Address, FBLALanAddress& OutAddress, FString& OutErrorCode);`
  - `static FString UBLALanStatics::BuildListenMapURL(const FString& MapPath, int32 Port = 7777);` returns `MapPath + "?listen"`. The Port argument is unused in the URL; listen bind uses `[URL] Port=7777`.
  - `static FString UBLALanStatics::GetAdvertiseIPv4();`
  - `UBLALanStatics` parent class `UBlueprintFunctionLibrary`
  - `UFUNCTION(BlueprintCallable)` on `ParseLANAddress`, `BuildListenMapURL`, `GetAdvertiseIPv4`, `RequestHostLANMatch`, `RequestJoinLANMatch`, `RequestLeaveLAN`
  - `bool UBLAGameInstance::RequestHostLANMatch();`
  - `bool UBLAGameInstance::RequestJoinLANMatch(const FString& Address);`
  - `bool UBLAGameInstance::RequestLeaveLAN();`
  - Error codes: `FLOW_LAN_INVALID_ADDRESS`, `FLOW_LAN_CONNECT_FAILED`, `FLOW_LAN_LISTEN_FAILED`. Reuse existing `FLOW_EMPTY_MAP` / `FLOW_DUPLICATE_TRAVEL` on host/join travel, matching `TravelTo()`.

- [ ] **Step 1: Write the failing contract + flow test**

`BLALanFlowTest` is a tick actor on the bootstrap map. When `-BLALanContracts` is present it runs address cases and GameInstance URL rules, then logs one marker.

```cpp
// Source/BLA/Public/BLALanFlowTest.h
UCLASS()
class ABLALanFlowTest : public AActor
{
    GENERATED_BODY()
public:
    ABLALanFlowTest();
    virtual void BeginPlay() override;
    void RunAddressContracts();
};
```

```cpp
void ABLALanFlowTest::RunAddressContracts()
{
    struct FCase { const TCHAR* Input; bool bExpectValid; int32 Port; const TCHAR* Error; };
    const FCase Cases[] = {
        { TEXT(""), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
        { TEXT("127.0.0.1"), true, 7777, TEXT("") },
        { TEXT("127.0.0.1:7777"), true, 7777, TEXT("") },
        { TEXT("192.168.1.10:9000"), true, 9000, TEXT("") },
        { TEXT("127.0.0.1:abc"), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
        { TEXT("999.1.1.1"), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
        { TEXT("localhost"), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
    };
    int32 Failed = 0;
    for (const FCase& Case : Cases)
    {
        FBLALanAddress Parsed;
        FString Error;
        const bool bValid = UBLALanStatics::ParseLANAddress(Case.Input, Parsed, Error);
        if (bValid != Case.bExpectValid || (bValid && Parsed.Port != Case.Port)
            || (!bValid && !Error.StartsWith(Case.Error)))
        {
            ++Failed;
            UE_LOG(LogTemp, Error, TEXT("BLA_LAN_CONTRACT_CASE_FAILED input=%s"), Case.Input);
        }
    }
    UBLAGameInstance* GI = GetWorld()->GetGameInstance<UBLAGameInstance>();
    const FString ListenURL = UBLALanStatics::BuildListenMapURL(GI->MatchMapPath, 7777);
    const bool bListenHasFlag = ListenURL.Contains(TEXT("?listen"));
    const bool bOfflineClean = !GI->MatchMapPath.Contains(TEXT("?listen"));
    if (Failed == 0 && bListenHasFlag && bOfflineClean)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_CONTRACTS_OK cases=%d listen=1 offline_clean=1"), UE_ARRAY_COUNT(Cases));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_CONTRACTS_FAILED failed=%d listen=%d offline_clean=%d"),
            Failed, bListenHasFlag ? 1 : 0, bOfflineClean ? 1 : 0);
    }
}
```

`Scripts/Editor/verify_lan_contracts.py`:

```python
import unreal

MARKER_OK = "BLA_LAN_CONTRACTS_OK"
ENGINE_INI = unreal.SystemLibrary.get_project_directory() + "Config/DefaultEngine.ini"

def fail(message):
    raise RuntimeError("LAN_CONTRACT_FAILURE " + message)

text = open(ENGINE_INI, encoding="utf-8").read()
if "Port=7777" not in text:
    fail("missing Port=7777")
if "OnlineSubsystemSteam" in text:
    fail("steam subsystem is not allowed")

world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
tests = unreal.GameplayStatics.get_all_actors_of_class(world, unreal.BLALanFlowTest)
if not tests:
    fail("BLALanFlowTest missing from bootstrap/editor world")
unreal.log("BLA_LAN_CONTRACTS_OK pending_runtime_marker")
```

Do not require the runtime marker in this editor-only script yet; Task 1 PIE in Step 4 emits `BLA_LAN_CONTRACTS_OK`. The contract script must still fail until `Port=7777` and `BLALanFlowTest` exist.

- [ ] **Step 2: Run the contract script and confirm it fails**

Run:

```powershell
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_contracts -Tag lan-task1
```

Expected: the runner cannot find `verify_lan_contracts` yet, or the script raises `LAN_CONTRACT_FAILURE missing Port=7777`. Do not add it to the default 25-check matrix.

- [ ] **Step 3: Implement parsing, travel, and engine port**

Append to `Config/DefaultEngine.ini`:

```ini
[URL]
Port=7777

[/Script/Engine.Engine]
!NetDriverDefinitions=ClearArray
+NetDriverDefinitions=(DefName="GameNetDriver",DriverClassName="/Script/OnlineSubsystemUtils.IpNetDriver",DriverClassNameFallback="/Script/OnlineSubsystemUtils.IpNetDriver")
```

Keep the existing `[/Script/Engine.Engine]` `NearClipPlane` line; merge into that section instead of duplicating the header if it already exists.

```cpp
// Source/BLA/Public/BLALanStatics.h
#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "BLALanStatics.generated.h"

USTRUCT(BlueprintType)
struct BLA_API FBLALanAddress
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly, Category="BLA|LAN")
    FString Host;
    UPROPERTY(BlueprintReadOnly, Category="BLA|LAN")
    int32 Port = 7777;
    UPROPERTY(BlueprintReadOnly, Category="BLA|LAN")
    bool bValid = false;
};

UCLASS()
class BLA_API UBLALanStatics : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static bool ParseLANAddress(const FString& Address, FBLALanAddress& OutAddress, FString& OutErrorCode);
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static FString BuildListenMapURL(const FString& MapPath, int32 Port = 7777);
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static FString GetAdvertiseIPv4();
};
```

Add `Sockets` next to `Engine` in `Source/BLA/BLA.Build.cs`:

```csharp
PublicDependencyModuleNames.AddRange(new string[]
{
    "Core",
    "CoreUObject",
    "Engine",
    "EnhancedInput",
    "AIModule",
    "GameplayTasks",
    "NavigationSystem",
    "UMG",
    "Sockets"
});
```

Declare GameInstance LAN entry points with `UFUNCTION(BlueprintCallable, Category="BLA|LAN")`.

```cpp
bool UBLALanStatics::ParseLANAddress(const FString& Address, FBLALanAddress& OutAddress, FString& OutErrorCode)
{
    OutAddress = FBLALanAddress{};
    OutErrorCode.Reset();
    const FString Trimmed = Address.TrimStartAndEnd();
    if (Trimmed.IsEmpty())
    {
        OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
        return false;
    }
    FString Host = Trimmed;
    int32 Port = 7777;
    int32 Colon = INDEX_NONE;
    if (Trimmed.FindLastChar(TCHAR(':'), Colon))
    {
        Host = Trimmed.Left(Colon);
        const FString PortText = Trimmed.Mid(Colon + 1);
        if (!PortText.IsNumeric())
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
        Port = FCString::Atoi(*PortText);
        if (Port < 1 || Port > 65535)
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
    }
    TArray<FString> Octets;
    Host.ParseIntoArray(Octets, TEXT("."));
    if (Octets.Num() != 4)
    {
        OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
        return false;
    }
    for (const FString& Octet : Octets)
    {
        if (!Octet.IsNumeric())
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
        const int32 Value = FCString::Atoi(*Octet);
        if (Value < 0 || Value > 255)
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
    }
    OutAddress.Host = Host;
    OutAddress.Port = Port;
    OutAddress.bValid = true;
    return true;
}

FString UBLALanStatics::BuildListenMapURL(const FString& MapPath, int32 Port)
{
    (void)Port; // Listen bind uses Config/DefaultEngine.ini [URL] Port=7777.
    return FString::Printf(TEXT("%s?listen"), *MapPath);
}
```

Include `SocketSubsystem.h` and `IPAddress.h` in `BLALanStatics.cpp`. Implementation:

```cpp
FString UBLALanStatics::GetAdvertiseIPv4()
{
    ISocketSubsystem* Sockets = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
    if (Sockets)
    {
        TArray<TSharedPtr<FInternetAddr>> Addresses;
        if (Sockets->GetLocalAdapterAddresses(Addresses))
        {
            for (const TSharedPtr<FInternetAddr>& Addr : Addresses)
            {
                if (!Addr.IsValid() || Addr->IsLoopbackAddress())
                {
                    continue;
                }
                const FString Text = Addr->ToString(false);
                if (Text.CountChar(TEXT('.')) == 3 && !Text.StartsWith(TEXT("127.")))
                {
                    return Text;
                }
            }
        }
    }
    return TEXT("127.0.0.1");
}

```

GameInstance:

```cpp
bool UBLAGameInstance::RequestStartMatch()
{
    return TravelTo(MatchMapPath); // MUST NOT append ?listen
}

bool UBLAGameInstance::RequestHostLANMatch()
{
    if (MatchMapPath.IsEmpty())
    {
        ReportFlowFailure(TEXT("FLOW_EMPTY_MAP"), TEXT("path is empty"));
        return false;
    }
    const FString URL = UBLALanStatics::BuildListenMapURL(MatchMapPath, 7777);
    LastTravelRequest = URL;
    if (bTravelInProgress || IsCurrentMap(MatchMapPath))
    {
        ReportFlowFailure(TEXT("FLOW_DUPLICATE_TRAVEL"), URL);
        return false;
    }
    LastFlowError.Empty();
    bTravelInProgress = true;
    if (bTravelImmediately)
    {
        UGameplayStatics::OpenLevel(this, FName(*MatchMapPath), true, TEXT("listen"));
    }
    return true;
}

bool UBLAGameInstance::RequestJoinLANMatch(const FString& Address)
{
    FBLALanAddress Parsed;
    FString Error;
    if (!UBLALanStatics::ParseLANAddress(Address, Parsed, Error))
    {
        ReportFlowFailure(Error.IsEmpty() ? TEXT("FLOW_LAN_INVALID_ADDRESS") : Error, Address);
        return false;
    }
    if (bTravelInProgress)
    {
        ReportFlowFailure(TEXT("FLOW_DUPLICATE_TRAVEL"), Address);
        return false;
    }
    const FString URL = FString::Printf(TEXT("%s:%d"), *Parsed.Host, Parsed.Port);
    LastTravelRequest = URL;
    LastFlowError.Empty();
    bTravelInProgress = true;
    if (APlayerController* PC = GetFirstLocalPlayerController())
    {
        PC->ClientTravel(URL, TRAVEL_Absolute);
        return true;
    }
    ReportFlowFailure(TEXT("FLOW_LAN_CONNECT_FAILED"), TEXT("no local player"));
    bTravelInProgress = false;
    return false;
}

bool UBLAGameInstance::RequestLeaveLAN()
{
    if (UWorld* World = GetWorld())
    {
        if (World->GetNetDriver())
        {
            GEngine->ShutdownWorldNetDriver(World);
        }
    }
    return TravelTo(MenuMapPath);
}
```

If listen bind fails, Unreal logs a net driver error; catch that in `OnWorldChanged` / next menu tick and `ReportFlowFailure("FLOW_LAN_LISTEN_FAILED")`. Do not leave the host stuck on a non-listening match map.

- [ ] **Step 4: Run address contracts in PIE**

Place `BP_BLALanFlowTest` on `L_TestBootstrap`. Run:

```powershell
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -Tag lan-task1
```

For this task, `verify_lan_pie.py` may be a stub that starts PIE on bootstrap with `-BLALanContracts` via `PIEOptions` / `FCommandLine` and waits for `BLA_LAN_CONTRACTS_OK`. If the pie script does not exist yet, run the editor once with:

```powershell
& "D:\Epic Games\UE_5.8\Engine\Binaries\Win64\UnrealEditor-Cmd.exe" "D:\dev\Blackarms-LibertyAmerica\BlackarmsLibertyAmerica.uproject" /Game/BLA/Maps/Graybox/L_TestBootstrap -game -log -BLALanContracts -unattended -nullrhi -nosound
```

Expected log: `BLA_LAN_CONTRACTS_OK cases=7 listen=1 offline_clean=1`. Also assert a standalone `RequestStartMatch` log/`LastTravelRequest` has no `?listen`.

- [ ] **Step 5: Commit**

```powershell
git add Source/BLA/Public/BLALanStatics.h Source/BLA/Private/BLALanStatics.cpp Source/BLA/Public/BLALanFlowTest.h Source/BLA/Private/BLALanFlowTest.cpp Source/BLA/Public/BLAGameInstance.h Source/BLA/Private/BLAGameInstance.cpp Source/BLA/BLA.Build.cs Config/DefaultEngine.ini Scripts/Editor/verify_lan_contracts.py Scripts/Editor/build_task10_assets.py
git commit -m "feat: add LAN travel entry points"
```

---


### Task 2: Waiting phase and replicated match state

**Files:**
- Create: `Source/BLA/Private/BLAGameState.cpp`, `Source/BLA/Private/BLAPlayerState.cpp`
- Modify: `Source/BLA/Public/BLAGameplayTypes.h`, `Source/BLA/Public/BLAGameState.h`, `Source/BLA/Public/BLAPlayerState.h`, `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`, `Source/BLA/Private/BLARoundManager.cpp`, `Scripts/Editor/verify_task2_contracts.py`, `Source/BLA/Private/BLALanFlowTest.cpp`
- Test: `Scripts/Editor/verify_lan_pie.py`, existing `verify_task2_contracts` and `verify_task11_pie`

**Interfaces:**
- Consumes: Task 1 `RequestHostLANMatch()`, NetMode from `UWorld::GetNetMode()`
- Produces:
  - `EBLA_RoundPhase::Waiting` appended after `MatchResult`
  - `USTRUCT FBLALanRosterEntry { FString DisplayName; EBLA_Team Team; bool bIsLANHost; }`
  - `ABLAGameState` replicated: `MatchMode`, `RoundPhase`, `CurrentRound`, scores, team sizes, `RoundTimeRemaining`, `CurrentObjectiveState`, `EBLA_DifficultyLevel DifficultyLevel`, `TArray<FBLALanRosterEntry> LANRoster`, `int32 LivingAttackers`, `int32 LivingDefenders`
  - `void ABLAGameModeElimination::RefreshLANRoster();`
  - `ABLAPlayerState` replicated: `Team`, `bIsLANHost`, `Kills`, `Deaths`, `DamageDealt`, `ObjectiveContribution`, `DeathState`
  - `void ABLAGameModeElimination::EnterLANWaiting();`
  - `bool ABLAGameModeElimination::IsLANListenMatch() const;`
  - Header declaration for `RefreshLANRoster()` lives in this task so `EnterLANWaiting` compiles.
  - Standalone `InitializeMatch()` behavior unchanged

- [ ] **Step 1: Extend the failing LAN flow test for Waiting**

In `ABLALanFlowTest`, if the world net mode is listen (or `-BLALanHost` later) and phase is not Waiting, fail. Add:

```cpp
void ABLALanFlowTest::RunWaitingContracts()
{
    const ABLAGameState* State = GetWorld()->GetGameState<ABLAGameState>();
    const ENetMode NetMode = GetWorld()->GetNetMode();
    int32 BotCount = 0;
    for (TActorIterator<ABLAAIController> It(GetWorld()); It; ++It) { ++BotCount; }
    const bool bWaiting = State && State->RoundPhase == EBLA_RoundPhase::Waiting;
    const bool bNoBots = BotCount == 0;
    if (NetMode == NM_ListenServer && bWaiting && bNoBots)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_WAITING_OK net=listen phase=%d bots=%d"),
            static_cast<int32>(State->RoundPhase), BotCount);
    }
    else if (NetMode == NM_Standalone)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_WAITING_SKIP standalone"));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_WAITING_FAILED net=%d phase=%d bots=%d"),
            static_cast<int32>(NetMode), State ? static_cast<int32>(State->RoundPhase) : -1, BotCount);
    }
}
```

Update `Scripts/Editor/verify_task2_contracts.py` enum list to append `"WAITING"` after `"MATCH_RESULT"`. If you forget this, the offline 25-check matrix fails.

- [ ] **Step 2: Run tests and confirm Waiting fails on current listen travel**

Host PIE/listen on the match map (use Task 1 `RequestHostLANMatch` from bootstrap). Expected: `BLA_LAN_WAITING_FAILED` because `InitializeMatch` still runs after 0.25s and starts Preparation with bots.

- [ ] **Step 3: Implement Waiting + replication**

Append enum value:

```cpp
UENUM(BlueprintType)
enum class EBLA_RoundPhase : uint8
{
    Loading,
    Preparation,
    Combat,
    ObjectiveUpload,
    RoundResult,
    MatchResult,
    Waiting
};
```

```cpp
USTRUCT(BlueprintType)
struct BLA_API FBLALanRosterEntry
{
    GENERATED_BODY()
    UPROPERTY() FString DisplayName;
    UPROPERTY() EBLA_Team Team = EBLA_Team::Neutral;
    UPROPERTY() bool bIsLANHost = false;
};
```

`ABLAGameState` / `ABLAPlayerState`: `GetLifetimeReplicatedProps` with `DOREPLIFETIME`. Set `bReplicates = true` in constructors (`AGameStateBase` already replicates; still mark new properties). `ABLAPlayerState::bIsLANHost` defaults false.

Add these replicated fields on `ABLAGameState` (existing Mode / TeamSize / phase fields stay; this task adds Difficulty, roster, and living counts):

```cpp
UPROPERTY(BlueprintReadOnly, Replicated, Category="BLA|Match")
EBLA_DifficultyLevel DifficultyLevel = EBLA_DifficultyLevel::Normal;

UPROPERTY(BlueprintReadOnly, Replicated, Category="BLA|LAN")
TArray<FBLALanRosterEntry> LANRoster;

UPROPERTY(BlueprintReadOnly, Replicated, Category="BLA|Match")
int32 LivingAttackers = 0;

UPROPERTY(BlueprintReadOnly, Replicated, Category="BLA|Match")
int32 LivingDefenders = 0;

virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
```

```cpp
void ABLAGameState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ABLAGameState, MatchMode);
    DOREPLIFETIME(ABLAGameState, RoundPhase);
    DOREPLIFETIME(ABLAGameState, CurrentRound);
    DOREPLIFETIME(ABLAGameState, AttackersScore);
    DOREPLIFETIME(ABLAGameState, DefendersScore);
    DOREPLIFETIME(ABLAGameState, AttackersTeamSize);
    DOREPLIFETIME(ABLAGameState, DefendersTeamSize);
    DOREPLIFETIME(ABLAGameState, RoundTimeRemaining);
    DOREPLIFETIME(ABLAGameState, CurrentObjectiveState);
    DOREPLIFETIME(ABLAGameState, DifficultyLevel);
    DOREPLIFETIME(ABLAGameState, LANRoster);
    DOREPLIFETIME(ABLAGameState, LivingAttackers);
    DOREPLIFETIME(ABLAGameState, LivingDefenders);
}
```

Spec 5.2 requires Difficulty to replicate with Mode / TeamSize / Waiting. Copy `GI->SelectedDifficultyLevel` in `EnterLANWaiting`. Do not invent a second difficulty source.

`ABLAGameModeElimination::BeginPlay`:

```cpp
void ABLAGameModeElimination::BeginPlay()
{
    Super::BeginPlay();
    TeamManager = GetWorld()->SpawnActor<ABLATeamManager>();
    RoundManager = GetWorld()->SpawnActor<ABLARoundManager>();
    TeamOrderManager = GetWorld()->SpawnActor<ABLATeamOrderManager>();
    RoleAssignment = GetWorld()->SpawnActor<ABLARoleAssignment>();
    TacticalManager = GetWorld()->SpawnActor<ABLATacticalManager>();
    if (GetWorld()->GetNetMode() == NM_ListenServer)
    {
        EnterLANWaiting();
        return;
    }
    GetWorldTimerManager().SetTimer(InitializeMatchTimer, this, &ABLAGameModeElimination::InitializeMatch, 0.25f, false);
}

bool ABLAGameModeElimination::IsLANListenMatch() const
{
    return GetWorld() && GetWorld()->GetNetMode() == NM_ListenServer;
}
```

Add these declarations to `ABLAGameModeElimination` in this task:

```cpp
void EnterLANWaiting();
bool IsLANListenMatch() const;
void RefreshLANRoster();
```

```cpp
void ABLAGameModeElimination::EnterLANWaiting()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    const UBLAGameInstance* GI = GetGameInstance<UBLAGameInstance>();
    if (State && GI)
    {
        State->MatchMode = GI->SelectedMode;
        State->AttackersTeamSize = GI->SelectedTeamSize;
        State->DefendersTeamSize = GI->SelectedTeamSize;
        State->DifficultyLevel = GI->SelectedDifficultyLevel;
        State->RoundPhase = EBLA_RoundPhase::Waiting;
    }
    if (APlayerController* PC = GetWorld()->GetFirstPlayerController())
    {
        if (ABLAPlayerState* PS = PC->GetPlayerState<ABLAPlayerState>())
        {
            PS->Team = EBLA_Team::Attackers;
            PS->bIsLANHost = true;
        }
        PC->UnPossess();
    }
    RefreshLANRoster();
    if (UIManager)
    {
        UIManager->Configure(this, RoundManager, TeamOrderManager);
    }
    UE_LOG(LogTemp, Display, TEXT("BLA_LAN_WAITING_ENTERED team_size=%d"),
        GI ? GI->SelectedTeamSize : 0);
}

void ABLAGameModeElimination::RefreshLANRoster()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!State)
    {
        return;
    }
    State->LANRoster.Reset();
    for (APlayerState* BasePS : State->PlayerArray)
    {
        ABLAPlayerState* PS = Cast<ABLAPlayerState>(BasePS);
        if (!PS || PS->IsABot())
        {
            continue;
        }
        FBLALanRosterEntry Entry;
        Entry.DisplayName = PS->GetPlayerName();
        Entry.Team = PS->Team;
        Entry.bIsLANHost = PS->bIsLANHost;
        State->LANRoster.Add(Entry);
    }
}
```

Override `SpawnDefaultPawnFor_Implementation` / `SpawnDefaultPawnAtTransform_Implementation` so that when `GetGameState<ABLAGameState>()->RoundPhase == Waiting`, return `nullptr`. Standalone still uses `DefaultPawnClass = ABLAPlayerCharacter`.

`ABLARoundManager::Tick`: if `RoundPhase == Waiting` or `Loading`, return before watchdog/timeout logic.

Do not replicate RoundManager. Server writes phase into GameState only.

- [ ] **Step 4: Verify Waiting and standalone still start**

```powershell
pwsh -File Scripts/run_verification.ps1 -Only verify_task2_contracts -Tag lan-task2
pwsh -File Scripts/run_verification.ps1 -Only verify_task11_pie -Tag lan-task2
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -Tag lan-task2
```

Expected:
- `BLA_TASK2_CONTRACTS_OK` (enum now includes WAITING)
- `BLA_ELIMINATION_MATCH_READY` still appears on standalone Zero Facility
- `BLA_LAN_WAITING_OK net=listen phase=6 bots=0` (Waiting ordinal is 6 if appended)

- [ ] **Step 5: Commit**

```powershell
git add Source/BLA/Public/BLAGameplayTypes.h Source/BLA/Public/BLAGameState.h Source/BLA/Private/BLAGameState.cpp Source/BLA/Public/BLAPlayerState.h Source/BLA/Private/BLAPlayerState.cpp Source/BLA/Public/BLAGameModeElimination.h Source/BLA/Private/BLAGameModeElimination.cpp Source/BLA/Private/BLARoundManager.cpp Scripts/Editor/verify_task2_contracts.py Source/BLA/Private/BLALanFlowTest.cpp
git commit -m "feat: add listen waiting phase"
```

---

### Task 3: Join gate, roster, and team select

**Files:**
- Modify: `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`, `Source/BLA/Public/BLAPlayerController.h`, `Source/BLA/Private/BLAPlayerController.cpp`, `Source/BLA/Private/BLALanFlowTest.cpp`, `Source/BLA/Public/BLALanFlowTest.h`
- Test: `Scripts/Editor/verify_lan_pie.py`

**Interfaces:**
- Consumes: Task 2 Waiting GameState, `ABLAPlayerState::Team`, `bIsLANHost`, `RefreshLANRoster()`
- Produces:
  - `virtual void ABLAGameModeElimination::PostLogin(APlayerController* NewPlayer) override;`
  - `virtual void ABLAGameModeElimination::Logout(AController* Exiting) override;`
  - `bool ABLAGameModeElimination::CanAcceptLANJoin() const;`
  - `int32 ABLAGameModeElimination::CountHumans() const;`
  - `int32 ABLAGameModeElimination::CountHumansOnTeam(EBLA_Team Team) const;`
  - `bool ABLAGameModeElimination::SetLANTeam(APlayerController* PC, EBLA_Team Team);`
  - `void ABLAPlayerController::ServerSetTeam_Implementation(EBLA_Team Team);` (`UFUNCTION(Server, Reliable)`)
  - `void ABLAPlayerController::ClientNotifyFlowError(const FString& Code);` (`UFUNCTION(Client, Reliable)`)
  - Kick / fail codes `FLOW_LAN_JOIN_REJECTED_FULL`, `FLOW_LAN_JOIN_REJECTED_STARTED`, `FLOW_LAN_TEAM_FULL`

- [ ] **Step 1: Write failing join/team cases on the listen world**

`ABLALanFlowTest` after Waiting:

```cpp
void ABLALanFlowTest::RunJoinAndTeamContracts()
{
    ABLAGameModeElimination* GM = GetWorld()->GetAuthGameMode<ABLAGameModeElimination>();
    ABLAPlayerController* HostPC = Cast<ABLAPlayerController>(GetWorld()->GetFirstPlayerController());
    if (!GM || !HostPC) { /* fail */ return; }

    const bool bHostSet = GM->SetLANTeam(HostPC, EBLA_Team::Defenders);
    const bool bHostAttack = GM->SetLANTeam(HostPC, EBLA_Team::Attackers);
    APlayerController* Extra = UGameplayStatics::CreatePlayer(GetWorld(), 1, true);
    const bool bAccepted = Extra != nullptr && GM->CanAcceptLANJoin();
    ABLAPlayerController* ExtraPC = Cast<ABLAPlayerController>(Extra);
    const bool bJoinNeutral = ExtraPC && ExtraPC->GetPlayerState<ABLAPlayerState>()
        && ExtraPC->GetPlayerState<ABLAPlayerState>()->Team == EBLA_Team::Neutral;
    ExtraPC->ServerSetTeam(EBLA_Team::Defenders);
    const bool bPicked = ExtraPC->GetPlayerState<ABLAPlayerState>()->Team == EBLA_Team::Defenders;

    // Fill both sides to TeamSize using CreatePlayer, then the next SetLANTeam must fail.
    // Log BLA_LAN_JOIN_OK / BLA_LAN_JOIN_FAILED with accepted, team_full, started_reject placeholders.
}
```

Use `SelectedTeamSize = 1` in this test so one extra Defender fills the side and a third player is rejected.

- [ ] **Step 2: Run and confirm fail**

`verify_lan_pie.py` starts bootstrap, calls `RequestHostLANMatch`, waits for `BLA_LAN_WAITING_OK`, then waits for `BLA_LAN_JOIN_OK`. Expected first run: `BLA_LAN_JOIN_FAILED` because `PostLogin`/`ServerSetTeam` do not exist.

- [ ] **Step 3: Implement gate and RPC**

```cpp
bool ABLAGameModeElimination::CanAcceptLANJoin() const
{
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!State || State->RoundPhase != EBLA_RoundPhase::Waiting)
    {
        return false;
    }
    const int32 TeamSize = State->AttackersTeamSize;
    return CountHumans() < TeamSize * 2;
}

void ABLAGameModeElimination::PostLogin(APlayerController* NewPlayer)
{
    Super::PostLogin(NewPlayer);
    if (!IsLANListenMatch())
    {
        return;
    }
    if (!CanAcceptLANJoin())
    {
        const ABLAGameState* State = GetGameState<ABLAGameState>();
        const FString Code = (State && State->RoundPhase != EBLA_RoundPhase::Waiting)
            ? FString(TEXT("FLOW_LAN_JOIN_REJECTED_STARTED"))
            : FString(TEXT("FLOW_LAN_JOIN_REJECTED_FULL"));
        if (ABLAPlayerController* PC = Cast<ABLAPlayerController>(NewPlayer))
        {
            PC->ClientNotifyFlowError(Code);
        }
        KickPlayer(NewPlayer, FText::FromString(Code));
        return;
    }
    if (ABLAPlayerState* PS = NewPlayer->GetPlayerState<ABLAPlayerState>())
    {
        if (!PS->bIsLANHost)
        {
            PS->Team = EBLA_Team::Neutral;
        }
    }
    NewPlayer->UnPossess();
    RefreshLANRoster();
}

bool ABLAGameModeElimination::SetLANTeam(APlayerController* PC, EBLA_Team Team)
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    ABLAPlayerState* PS = PC ? PC->GetPlayerState<ABLAPlayerState>() : nullptr;
    if (!State || !PS || State->RoundPhase != EBLA_RoundPhase::Waiting)
    {
        return false;
    }
    if (Team != EBLA_Team::Attackers && Team != EBLA_Team::Defenders)
    {
        return false;
    }
    if (PS->Team != Team && CountHumansOnTeam(Team) >= State->AttackersTeamSize)
    {
        if (UBLAGameInstance* GI = GetGameInstance<UBLAGameInstance>())
        {
            GI->ReportFlowFailure(TEXT("FLOW_LAN_TEAM_FULL"));
        }
        if (ABLAPlayerController* BLAPC = Cast<ABLAPlayerController>(PC))
        {
            BLAPC->ClientNotifyFlowError(TEXT("FLOW_LAN_TEAM_FULL"));
        }
        return false;
    }
    PS->Team = Team;
    RefreshLANRoster();
    return true;
}

void ABLAPlayerController::ServerSetTeam_Implementation(EBLA_Team Team)
{
    if (ABLAGameModeElimination* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr)
    {
        GM->SetLANTeam(this, Team);
    }
}

UFUNCTION(Client, Reliable)
void ClientNotifyFlowError(const FString& Code);

void ABLAPlayerController::ClientNotifyFlowError_Implementation(const FString& Code)
{
    if (UBLAGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr)
    {
        GI->ReportFlowFailure(Code);
        const bool bLeave = Code.Contains(TEXT("FLOW_LAN_HOST_LEFT"))
            || Code.Contains(TEXT("FLOW_LAN_JOIN_REJECTED_FULL"))
            || Code.Contains(TEXT("FLOW_LAN_JOIN_REJECTED_STARTED"))
            || Code.Contains(TEXT("FLOW_LAN_CONNECT_FAILED"))
            || Code.Contains(TEXT("FLOW_LAN_LISTEN_FAILED"));
        if (bLeave)
        {
            GI->RequestLeaveLAN();
        }
    }
}
```

`CountHumans` / `CountHumansOnTeam` iterate `GameState->PlayerArray`, skip bots (`IsABot()`), count `ABLAPlayerState`.

`RefreshLANRoster` is the Task 2 function. Keep calling it from `PostLogin` / `SetLANTeam` / `Logout`. It rebuilds `State->LANRoster` from that array (DisplayName = `GetPlayerName()`, Team, bIsLANHost).

`Logout`: if listen and Waiting, refresh roster. If the host controller leaves, call every remaining PC's GameInstance `RequestLeaveLAN` path: destroy session and travel clients to menu with `FLOW_LAN_HOST_LEFT`. Host detection: `PlayerState->bIsLANHost`.

On kicked clients, call `ClientNotifyFlowError` **before** `KickPlayer`. JOIN_REJECTED_* leaves to the menu. TEAM_FULL / NOT_HOST stay in Waiting because `ClientNotifyFlowError` does not leave on those codes. Keep this same leave-code set in Task 5.

- [ ] **Step 4: Run LAN PIE join cases**

Expected log: `BLA_LAN_JOIN_OK accepted=1 team_pick=1 team_full=1 started_reject=0` while still Waiting (started_reject is covered in Task 4).

- [ ] **Step 5: Commit**

```powershell
git add Source/BLA/Public/BLAGameModeElimination.h Source/BLA/Private/BLAGameModeElimination.cpp Source/BLA/Public/BLAPlayerController.h Source/BLA/Private/BLAPlayerController.cpp Source/BLA/Private/BLALanFlowTest.cpp Source/BLA/Public/BLALanFlowTest.h
git commit -m "feat: gate LAN join and team select"
```

---


### Task 4: Host Start, Neutral assignment, and AI fill

**Files:**
- Modify: `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`, `Source/BLA/Public/BLAPlayerController.h`, `Source/BLA/Private/BLAPlayerController.cpp`, `Source/BLA/Public/BLALanFlowTest.h`, `Source/BLA/Private/BLALanFlowTest.cpp`, `Source/BLA/Private/BLARoundManager.cpp`
- Test: `ABLALanFlowTest::RunStartContracts()` plus later `Scripts/Editor/verify_lan_pie.py` (Task 7 waits for these markers)

**Interfaces:**
- Consumes: Task 2 `EnterLANWaiting()`, `IsLANListenMatch()`, replicated `ABLAGameState` / `ABLAPlayerState`; Task 3 `SetLANTeam()`, `CanAcceptLANJoin()`, `CountHumans()`, `CountHumansOnTeam()`, `RefreshLANRoster()`, `ServerSetTeam`
- Produces:
  - `bool ABLAGameModeElimination::StartLANMatch(APlayerController* Requestor);`
  - `void ABLAGameModeElimination::AssignNeutralHumansForLAN();`
  - `bool ABLAGameModeElimination::PossessLANHumans();`
  - `void ABLAGameModeElimination::FillLANBots(int32 TeamSize, TArray<ABLAAIController*>& OutAttackerBots, TArray<ABLAAIController*>& OutDefenderBots);`
  - `void ABLAGameModeElimination::FillVacantLANSlotsWithBots();` (declare in the Task 4 header; implement the body in Task 5)
  - `APawn* ABLAGameModeElimination::SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot);` returns `nullptr` while `RoundPhase == Waiting`
  - `APawn* ABLAGameModeElimination::SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform);` also returns `nullptr` while Waiting
  - `void ABLAPlayerController::ServerStartLANMatch();` (`UFUNCTION(Server, Reliable)`)
  - Standalone `InitializeMatch()` still assumes one local human on Attackers and spawns `TeamSize-1` attacker bots + `TeamSize` defender bots. Do not change that path.

- [ ] **Step 1: Write the failing Start contracts**

Add to `ABLALanFlowTest` and call it after join/team contracts succeed:

```cpp
void ABLALanFlowTest::RunStartContracts()
{
    ABLAGameModeElimination* GM = GetWorld()->GetAuthGameMode<ABLAGameModeElimination>();
    ABLAGameState* State = GetWorld()->GetGameState<ABLAGameState>();
    ABLAPlayerController* HostPC = Cast<ABLAPlayerController>(GetWorld()->GetFirstPlayerController());
    if (!GM || !State || !HostPC)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_START_FAILED reason=missing_world"));
        return;
    }

    UBLAGameInstance* GI = GetGameInstance<UBLAGameInstance>();
    if (GI)
    {
        GI->ApplyTeamSize(2);
        State->AttackersTeamSize = 2;
        State->DefendersTeamSize = 2;
    }

    GM->SetLANTeam(HostPC, EBLA_Team::Attackers);
    APlayerController* Extra = UGameplayStatics::CreatePlayer(GetWorld(), 1, true);
    ABLAPlayerController* ExtraPC = Cast<ABLAPlayerController>(Extra);
    if (ExtraPC)
    {
        ExtraPC->ServerSetTeam(EBLA_Team::Defenders);
        ExtraPC->ServerStartLANMatch();
    }
    const bool bStillWaitingAfterClientStart = State->RoundPhase == EBLA_RoundPhase::Waiting;
    const bool bNotHostReported = GI && GI->LastFlowError.Contains(TEXT("FLOW_LAN_NOT_HOST"));

    const bool bHostStarted = GM->StartLANMatch(HostPC);
    int32 BotCount = 0;
    int32 CombatantCount = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotCount; }
    for (TActorIterator<ABLACharacterBase> It(GetWorld()); It; ++It) { ++CombatantCount; }

    const bool bRejectAfterStart = !GM->CanAcceptLANJoin();
    APlayerController* Late = UGameplayStatics::CreatePlayer(GetWorld(), 2, true);
    const bool bLateRejected = Late == nullptr || !GM->CanAcceptLANJoin();
    if (Late)
    {
        UGameplayStatics::RemovePlayer(Late, true);
    }

    const bool bPhasePrep = State->RoundPhase == EBLA_RoundPhase::Preparation;
    if (bHostStarted && bStillWaitingAfterClientStart && bNotHostReported && bPhasePrep
        && BotCount == 2 && CombatantCount == 4 && bRejectAfterStart && bLateRejected)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_START_OK not_host=1 bots=%d total=%d started_reject=1"),
            BotCount, CombatantCount);
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_START_FAILED not_host=%d started=%d phase=%d bots=%d total=%d reject=%d"),
            bStillWaitingAfterClientStart && bNotHostReported ? 1 : 0,
            bHostStarted ? 1 : 0,
            State ? static_cast<int32>(State->RoundPhase) : -1,
            BotCount, CombatantCount, bRejectAfterStart ? 1 : 0);
    }
}
```

Also add a Neutral-assignment case in the same actor (TeamSize=1, both humans Neutral at Start): host becomes Attackers, extra becomes Defenders because Attackers is full. Log `BLA_LAN_NEUTRAL_OK host=0 extra=1` where 0 is Attackers and 1 is Defenders.

- [ ] **Step 2: Run and confirm fail**

Host the match map with Task 1 `RequestHostLANMatch`, wait for `BLA_LAN_WAITING_OK` and `BLA_LAN_JOIN_OK`, then `RunStartContracts`. Expected: `BLA_LAN_START_FAILED` because `ServerStartLANMatch` / `StartLANMatch` do not exist and `InitializeMatch` still does not run from Waiting.

- [ ] **Step 3: Implement Start, Neutral fill, pawn spawn, and AI fill**

Header additions on `ABLAGameModeElimination` (include both default-pawn overrides so Waiting never spawns a combat pawn):

```cpp
public:
    virtual APawn* SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot) override;
    virtual APawn* SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform) override;
    bool StartLANMatch(APlayerController* Requestor);
    void FillVacantLANSlotsWithBots();
protected:
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual void Logout(AController* Exiting) override;
private:
    void AssignNeutralHumansForLAN();
    bool PossessLANHumans();
    void FillLANBots(int32 TeamSize, TArray<ABLAAIController*>& OutAttackerBots, TArray<ABLAAIController*>& OutDefenderBots);
    void LaunchPreparedMatch(int32 TeamSize, EBLA_MatchMode Mode, ABLAMapConfig* MapConfig,
        const TArray<ABLAAIController*>& AttackerBots, const TArray<ABLAAIController*>& DefenderBots,
        ABLAPlayerCharacter* OrderAnchor);
    ABLAMapConfig* FindMapConfig() const;
```

Keep `InitializeMatch()` as the standalone-only function. After it gathers `Player`, `TeamSize`, `Mode`, and `MapConfig`, leave the current "one human attacker + TeamSize-1 attacker bots + TeamSize defender bots" loops untouched. Extract only the tail (role assignment, `ConfigureTeamSystems`, objective configure, `RoundManager->StartMatch`, HUD) into `LaunchPreparedMatch` and call it from both paths.

Waiting must not spawn a combat pawn:

```cpp
APawn* ABLAGameModeElimination::SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot)
{
    if (const ABLAGameState* State = GetGameState<ABLAGameState>();
        IsLANListenMatch() && State && State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        return nullptr;
    }
    return Super::SpawnDefaultPawnFor_Implementation(NewPlayer, StartSpot);
}

APawn* ABLAGameModeElimination::SpawnDefaultPawnAtTransform_Implementation(AController* NewPlayer, const FTransform& SpawnTransform)
{
    if (const ABLAGameState* State = GetGameState<ABLAGameState>();
        IsLANListenMatch() && State && State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        return nullptr;
    }
    return Super::SpawnDefaultPawnAtTransform_Implementation(NewPlayer, SpawnTransform);
}
```

PlayerController RPC:

```cpp
UFUNCTION(Server, Reliable)
void ServerStartLANMatch();

void ABLAPlayerController::ServerStartLANMatch_Implementation()
{
    if (ABLAGameModeElimination* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr)
    {
        GM->StartLANMatch(this);
    }
}
```

Start implementation (no extra `bLANMatchStarted` flag; `RoundPhase != Waiting` is the gate):

```cpp
bool ABLAGameModeElimination::StartLANMatch(APlayerController* Requestor)
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    UBLAGameInstance* GI = GetGameInstance<UBLAGameInstance>();
    ABLAPlayerState* RequestorPS = Requestor ? Requestor->GetPlayerState<ABLAPlayerState>() : nullptr;
    if (!IsLANListenMatch() || !State || State->RoundPhase != EBLA_RoundPhase::Waiting)
    {
        return false;
    }
    if (!RequestorPS || !RequestorPS->bIsLANHost)
    {
        if (GI)
        {
            GI->ReportFlowFailure(TEXT("FLOW_LAN_NOT_HOST"));
        }
        return false;
    }

    const int32 TeamSize = FMath::Clamp(State->AttackersTeamSize, 1, 3);
    AssignNeutralHumansForLAN();
    if (!PossessLANHumans())
    {
        return false;
    }

    TArray<ABLAAIController*> AttackerBots;
    TArray<ABLAAIController*> DefenderBots;
    FillLANBots(TeamSize, AttackerBots, DefenderBots);

    ABLAPlayerCharacter* Anchor = nullptr;
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
    {
        if (ABLAPlayerCharacter* Pawn = It->Get() ? Cast<ABLAPlayerCharacter>(It->Get()->GetPawn()) : nullptr)
        {
            Anchor = Pawn;
            break;
        }
    }
    LaunchPreparedMatch(TeamSize, State->MatchMode, FindMapConfig(), AttackerBots, DefenderBots, Anchor);
    RefreshLANRoster();
    if (State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        State->RoundPhase = EBLA_RoundPhase::Preparation;
    }
    State->LivingAttackers = TeamManager ? TeamManager->GetLivingCount(EBLA_Team::Attackers) : TeamSize;
    State->LivingDefenders = TeamManager ? TeamManager->GetLivingCount(EBLA_Team::Defenders) : TeamSize;
    return true;
}

void ABLAGameModeElimination::AssignNeutralHumansForLAN()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!State)
    {
        return;
    }
    const int32 TeamSize = State->AttackersTeamSize;
    for (APlayerState* BasePS : State->PlayerArray)
    {
        ABLAPlayerState* PS = Cast<ABLAPlayerState>(BasePS);
        if (!PS || PS->IsABot() || PS->Team != EBLA_Team::Neutral)
        {
            continue;
        }
        const int32 AttackHumans = CountHumansOnTeam(EBLA_Team::Attackers);
        const int32 DefenseHumans = CountHumansOnTeam(EBLA_Team::Defenders);
        EBLA_Team Preferred = AttackHumans <= DefenseHumans ? EBLA_Team::Attackers : EBLA_Team::Defenders;
        if (CountHumansOnTeam(Preferred) >= TeamSize)
        {
            Preferred = Preferred == EBLA_Team::Attackers ? EBLA_Team::Defenders : EBLA_Team::Attackers;
        }
        PS->Team = Preferred;
    }
}

bool ABLAGameModeElimination::PossessLANHumans()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!State || !TeamManager)
    {
        return false;
    }
    int32 HumanIndex = 0;
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
    {
        APlayerController* PC = It->Get();
        ABLAPlayerState* PS = PC ? PC->GetPlayerState<ABLAPlayerState>() : nullptr;
        if (!PC || !PS || PS->IsABot())
        {
            continue;
        }
        const EBLA_Team Team = PS->Team;
        const FName Zone = Team == EBLA_Team::Defenders ? TEXT("DefenseSpawn") : TEXT("AttackSpawn");
        ABLASpawnPoint* Spawn = TeamManager->SelectSpawnPoint(Team, Zone);
        const FTransform Transform = Spawn ? Spawn->GetActorTransform() : FTransform(FVector(0.0f, HumanIndex * 250.0f, 120.0f));
        FActorSpawnParameters Params;
        Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        ABLAPlayerCharacter* Pawn = GetWorld()->SpawnActor<ABLAPlayerCharacter>(ABLAPlayerCharacter::StaticClass(), Transform, Params);
        if (!Pawn)
        {
            return false;
        }
        Pawn->Team = Team;
        PC->Possess(Pawn);
        if (!TeamManager->RegisterCombatant(Pawn) || !EquipLoadout(Pawn))
        {
            return false;
        }
        if (ABLAPlayerController* BLAPC = Cast<ABLAPlayerController>(PC))
        {
            BLAPC->ConfigureTeamSystems(TeamManager, TeamOrderManager);
        }
        ++HumanIndex;
    }
    return HumanIndex > 0;
}

void ABLAGameModeElimination::FillLANBots(int32 TeamSize, TArray<ABLAAIController*>& OutAttackerBots, TArray<ABLAAIController*>& OutDefenderBots)
{
    const int32 AttackerBotsNeeded = FMath::Max(0, TeamSize - CountHumansOnTeam(EBLA_Team::Attackers));
    const int32 DefenderBotsNeeded = FMath::Max(0, TeamSize - CountHumansOnTeam(EBLA_Team::Defenders));
    for (int32 Index = 0; Index < AttackerBotsNeeded; ++Index)
    {
        if (ABLAAIController* AI = SpawnBot(EBLA_Team::Attackers, Index + CountHumansOnTeam(EBLA_Team::Attackers), TEXT("AttackSpawn")))
        {
            OutAttackerBots.Add(AI);
        }
    }
    for (int32 Index = 0; Index < DefenderBotsNeeded; ++Index)
    {
        if (ABLAAIController* AI = SpawnBot(EBLA_Team::Defenders, Index + CountHumansOnTeam(EBLA_Team::Defenders), TEXT("DefenseSpawn")))
        {
            OutDefenderBots.Add(AI);
        }
    }
}
```

`LaunchPreparedMatch` is the extracted tail of today's `InitializeMatch()` starting at `RoleAssignment->AssignRoles` through `RoundManager->StartMatch(ResolveRules(TeamSize))` and `UIManager->OpenMatchHUD()`. Use `OrderAnchor` in place of the standalone `Player` pointer when calling `ResolveRoleDirective` for attacker bots. If `OrderAnchor` is a defender, pass `nullptr` as the attacker human anchor (same as current defender-bot calls).

Standalone `InitializeMatch()` must still:
1. Require the first local `ABLAPlayerCharacter`.
2. Force that pawn to `EBLA_Team::Attackers` and teleport to AttackSpawn.
3. Spawn `TeamSize - 1` attacker bots and `TeamSize` defender bots.
4. Call `LaunchPreparedMatch`.

Do not call `InitializeMatch()` from the LAN Start path.

- [ ] **Step 4: Run Start contracts**

Expected: `BLA_LAN_START_OK not_host=1 bots=2 total=4 started_reject=1` and `BLA_LAN_NEUTRAL_OK host=0 extra=1`. `CanAcceptLANJoin()` is false because `RoundPhase` is Preparation, not because of a new bool.

- [ ] **Step 5: Commit**

```powershell
git add Source/BLA/Public/BLAGameModeElimination.h Source/BLA/Private/BLAGameModeElimination.cpp Source/BLA/Public/BLAPlayerController.h Source/BLA/Private/BLAPlayerController.cpp Source/BLA/Public/BLALanFlowTest.h Source/BLA/Private/BLALanFlowTest.cpp Source/BLA/Private/BLARoundManager.cpp
git commit -m "feat: start LAN match with AI fill"
```

---


### Task 5: Server-authoritative combat and disconnects

**Files:**
- Modify: `Source/BLA/Public/BLAHealthComponent.h`, `Source/BLA/Private/BLAHealthComponent.cpp`, `Source/BLA/Public/BLACharacterBase.h`, `Source/BLA/Private/BLACharacterBase.cpp`, `Source/BLA/Public/BLAWeaponComponent.h`, `Source/BLA/Private/BLAWeaponComponent.cpp`, `Source/BLA/Public/BLAPlayerController.h`, `Source/BLA/Private/BLAPlayerController.cpp`, `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`, `Source/BLA/Private/BLARoundManager.cpp`, `Source/BLA/Public/BLAGameInstance.h`, `Source/BLA/Private/BLAGameInstance.cpp`, `Source/BLA/Private/BLALanFlowTest.cpp`
- Test: `ABLALanFlowTest::RunAuthorityAndDisconnectContracts()`

**Interfaces:**
- Consumes: Task 4 `StartLANMatch`, `FillVacantLANSlotsWithBots`, `SpawnBot`, `CountHumansOnTeam`; Task 3 `Logout` Waiting roster refresh and `ClientNotifyFlowError`; Task 1 `RequestLeaveLAN`, `ReportFlowFailure`
- Produces:
  - `bool UBLAHealthComponent::ApplyDamage(...)` no-ops unless `GetOwner()->HasAuthority()`
  - `void ABLAPlayerController::ServerFireWeapon(FVector TraceStart, FVector AimDirection);`
  - `void ABLAPlayerController::ServerReloadWeapon();`
  - `void ABLAPlayerController::ClientNotifyFlowError(const FString& Code);`
  - Replicated `UBLAHealthComponent::{CurrentHealth,bIsDead}`, `ABLACharacterBase::Team`, `UBLAWeaponComponent::{ReplicatedMagazineAmmo,ReplicatedReserveAmmo}`
  - Post-Start `Logout`: current round keeps an empty human slot (no Possess-replace); `FillVacantLANSlotsWithBots()` runs on the next round
  - Host `Logout` tears the listen session down with `FLOW_LAN_HOST_LEFT`
  - `ClientNotifyFlowError` leaves the session only for HOST_LEFT / JOIN_REJECTED_* / CONNECT_FAILED / LISTEN_FAILED. `FLOW_LAN_NOT_HOST` and `FLOW_LAN_TEAM_FULL` stay in Waiting

- [ ] **Step 1: Write failing authority and disconnect tests**

```cpp
void ABLALanFlowTest::RunAuthorityAndDisconnectContracts()
{
    ABLAGameModeElimination* GM = GetWorld()->GetAuthGameMode<ABLAGameModeElimination>();
    ABLAGameState* State = GetWorld()->GetGameState<ABLAGameState>();
    if (!GM || !State || State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_AUTHORITY_FAILED reason=not_started"));
        return;
    }

    ABLABotCharacter* Victim = nullptr;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It)
    {
        Victim = *It;
        break;
    }
    const bool bServerDamage = Victim && Victim->ApplyCombatDamage(15.0f, TEXT("Body"), nullptr);
    const float HealthAfterServer = Victim && Victim->HealthComponent ? Victim->HealthComponent->CurrentHealth : -1.0f;

    // Simulated non-authority call: ApplyDamage must reject when the owner has no authority.
    // Listen-server PIE with CreatePlayer cannot create a remote ROLE_SimulatedProxy, so the
    // contract asserts the guard exists by temporarily using a detached component owner check
    // and by logging bServerDamage. Real client rejection is Task 7 PIE NumberOfClients=2.
    int32 HumansBefore = GM->CountHumans();
    int32 BotsBefore = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotsBefore; }

    APlayerController* Extra = nullptr;
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
    {
        if (It->Get() && It->Get() != GetWorld()->GetFirstPlayerController())
        {
            Extra = It->Get();
            break;
        }
    }
    if (Extra)
    {
        UGameplayStatics::RemovePlayer(Extra, true);
    }
    const int32 HumansAfterLeave = GM->CountHumans();
    int32 BotsAfterLeave = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotsAfterLeave; }

    GM->FillVacantLANSlotsWithBots();
    int32 BotsAfterFill = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotsAfterFill; }

    if (bServerDamage && HealthAfterServer < 100.0f && HumansAfterLeave == HumansBefore - 1
        && BotsAfterLeave == BotsBefore && BotsAfterFill == BotsBefore + 1)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_AUTHORITY_OK damage_server=1 leave_empty_slot=1 next_round_fill=1"));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_AUTHORITY_FAILED dmg=%d health=%.1f humans=%d/%d bots=%d/%d/%d"),
            bServerDamage ? 1 : 0, HealthAfterServer, HumansBefore, HumansAfterLeave,
            BotsBefore, BotsAfterLeave, BotsAfterFill);
    }
}
```

Call this after `RunStartContracts`. Host-leave is asserted in Task 7 (real client). This task still implements host-leave now.

- [ ] **Step 2: Run and confirm fail**

Expected: `BLA_LAN_AUTHORITY_FAILED` because `FillVacantLANSlotsWithBots` is empty, `ApplyDamage` has no authority guard, and fire still runs locally with no Server RPC.

- [ ] **Step 3: Implement authority, replication, and disconnect rules**

Health:

```cpp
UBLAHealthComponent::UBLAHealthComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

void UBLAHealthComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UBLAHealthComponent, CurrentHealth);
    DOREPLIFETIME(UBLAHealthComponent, bIsDead);
}

bool UBLAHealthComponent::ApplyDamage(float Amount, FName DamageLocation, AActor* InstigatorActor)
{
    if (!GetOwner() || !GetOwner()->HasAuthority() || bIsDead || Amount <= 0.0f)
    {
        return false;
    }
    // existing clamp / broadcast / HandleDeath body
}
```

Character:

```cpp
ABLACharacterBase::ABLACharacterBase()
{
    bReplicates = true;
    SetReplicateMovement(true);
    // existing component setup
}

void ABLACharacterBase::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ABLACharacterBase, Team);
}
```

Weapon: `SetIsReplicatedByDefault(true)`. After a successful `FireWeapon` / `ReloadWeapon` / `SwitchWeapon` on the server, copy magazine/reserve into replicated ints:

```cpp
UPROPERTY(ReplicatedUsing = OnRep_Ammo)
int32 ReplicatedMagazineAmmo = 0;
UPROPERTY(Replicated)
int32 ReplicatedReserveAmmo = 0;

void UBLAWeaponComponent::PushReplicatedAmmo()
{
    if (const FWeaponSlotState* State = CurrentState())
    {
        ReplicatedMagazineAmmo = State->MagazineAmmo;
        ReplicatedReserveAmmo = State->ReserveAmmo;
    }
}

int32 UBLAWeaponComponent::GetCurrentAmmo() const
{
    if (GetOwner() && !GetOwner()->HasAuthority())
    {
        return ReplicatedMagazineAmmo;
    }
    const FWeaponSlotState* State = CurrentState();
    return State ? State->MagazineAmmo : 0;
}
```

`FireWeapon` must return false when `!GetOwner()->HasAuthority()`. Listen-server and standalone both have authority, so offline fire still works.

PlayerController:

```cpp
UFUNCTION(Server, Reliable)
void ServerFireWeapon(FVector TraceStart, FVector AimDirection);
UFUNCTION(Server, Reliable)
void ServerReloadWeapon();
UFUNCTION(Client, Reliable)
void ClientNotifyFlowError(const FString& Code);

void ABLAPlayerController::OnFireRequested_Implementation()
{
    ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn());
    if (!BLACharacter || !BLACharacter->FirstPersonCamera || !BLACharacter->WeaponComponent)
    {
        return;
    }
    const FVector Start = BLACharacter->FirstPersonCamera->GetComponentLocation();
    const FVector Dir = BLACharacter->FirstPersonCamera->GetForwardVector();
    if (HasAuthority())
    {
        BLACharacter->WeaponComponent->FireWeapon(Start, Dir);
    }
    else
    {
        ServerFireWeapon(Start, Dir);
    }
}

void ABLAPlayerController::ServerFireWeapon_Implementation(FVector TraceStart, FVector AimDirection)
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn());
        BLACharacter && BLACharacter->WeaponComponent)
    {
        BLACharacter->WeaponComponent->FireWeapon(TraceStart, AimDirection);
    }
}

void ABLAPlayerController::OnReloadRequested_Implementation()
{
    if (HasAuthority())
    {
        if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn());
            BLACharacter && BLACharacter->WeaponComponent)
        {
            BLACharacter->WeaponComponent->ReloadWeapon();
        }
    }
    else
    {
        ServerReloadWeapon();
    }
}

void ABLAPlayerController::ClientNotifyFlowError_Implementation(const FString& Code)
{
    if (UBLAGameInstance* GI = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr)
    {
        GI->ReportFlowFailure(Code);
        const bool bLeave = Code.Contains(TEXT("FLOW_LAN_HOST_LEFT"))
            || Code.Contains(TEXT("FLOW_LAN_JOIN_REJECTED_FULL"))
            || Code.Contains(TEXT("FLOW_LAN_JOIN_REJECTED_STARTED"))
            || Code.Contains(TEXT("FLOW_LAN_CONNECT_FAILED"))
            || Code.Contains(TEXT("FLOW_LAN_LISTEN_FAILED"));
        if (bLeave)
        {
            GI->RequestLeaveLAN();
        }
    }
}
```

`Logout` (extend Task 3; do not Possess-replace mid-round):

```cpp
void ABLAGameModeElimination::Logout(AController* Exiting)
{
    const bool bWasHost = Exiting && Exiting->GetPlayerState<ABLAPlayerState>()
        && Exiting->GetPlayerState<ABLAPlayerState>()->bIsLANHost;
    const ABLAGameState* StateBefore = GetGameState<ABLAGameState>();
    const bool bHadStarted = StateBefore && StateBefore->RoundPhase != EBLA_RoundPhase::Waiting;
    if (ABLACharacterBase* Pawn = Exiting ? Cast<ABLACharacterBase>(Exiting->GetPawn()) : nullptr)
    {
        if (TeamManager)
        {
            TeamManager->UnregisterCombatant(Pawn);
        }
    }
    Super::Logout(Exiting);
    if (!IsLANListenMatch())
    {
        return;
    }
    if (bWasHost)
    {
        for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
        {
            if (ABLAPlayerController* PC = Cast<ABLAPlayerController>(It->Get()))
            {
                PC->ClientNotifyFlowError(TEXT("FLOW_LAN_HOST_LEFT"));
            }
        }
        if (UBLAGameInstance* GI = GetGameInstance<UBLAGameInstance>())
        {
            GI->RequestLeaveLAN();
        }
        return;
    }
    RefreshLANRoster();
    if (ABLAGameState* State = GetGameState<ABLAGameState>())
    {
        if (TeamManager)
        {
            State->LivingAttackers = TeamManager->GetLivingCount(EBLA_Team::Attackers);
            State->LivingDefenders = TeamManager->GetLivingCount(EBLA_Team::Defenders);
        }
    }
    // Waiting: slot is free for a new join (CanAcceptLANJoin uses CountHumans).
    // Started: leave the slot empty this round. Next round calls FillVacantLANSlotsWithBots.
}

void ABLAGameModeElimination::FillVacantLANSlotsWithBots()
{
    if (!IsLANListenMatch() || !TeamManager)
    {
        return;
    }
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    const int32 TeamSize = State ? State->AttackersTeamSize : 1;
    TArray<ABLAAIController*> UnusedA;
    TArray<ABLAAIController*> UnusedD;
    FillLANBots(TeamSize, UnusedA, UnusedD);
    if (RoleAssignment)
    {
        RoleAssignment->AssignRoles(UnusedA);
        RoleAssignment->AssignRoles(UnusedD);
    }
}
```

Hook next-round fill from `ABLARoundManager::StartNextRound` after `ResetAllCombatants()`:

```cpp
if (ABLAGameModeElimination* GM = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr)
{
    GM->FillVacantLANSlotsWithBots();
}
```

Also update `LivingAttackers` / `LivingDefenders` in the existing death handler next to `TeamManager->GetLivingCount`. Do not change `ai_attacker_carry` or bot pathing.

- [ ] **Step 4: Run authority contracts**

Expected: `BLA_LAN_AUTHORITY_OK damage_server=1 leave_empty_slot=1 next_round_fill=1`. Offline standalone fire still works because the listen/standalone host has authority.

- [ ] **Step 5: Commit**

```powershell
git add Source/BLA/Public/BLAHealthComponent.h Source/BLA/Private/BLAHealthComponent.cpp Source/BLA/Public/BLACharacterBase.h Source/BLA/Private/BLACharacterBase.cpp Source/BLA/Public/BLAWeaponComponent.h Source/BLA/Private/BLAWeaponComponent.cpp Source/BLA/Public/BLAPlayerController.h Source/BLA/Private/BLAPlayerController.cpp Source/BLA/Public/BLAGameModeElimination.h Source/BLA/Private/BLAGameModeElimination.cpp Source/BLA/Private/BLARoundManager.cpp Source/BLA/Public/BLAGameInstance.h Source/BLA/Private/BLAGameInstance.cpp Source/BLA/Private/BLALanFlowTest.cpp
git commit -m "feat: make LAN combat server authoritative"
```

---


### Task 6: Waiting UI, menu Host/Join, world GameState HUD, test command line

**Files:**
- Modify: `Source/BLA/Public/BLAUIManager.h`, `Source/BLA/Private/BLAUIManager.cpp`, `Source/BLA/Public/BLAGameInstance.h`, `Source/BLA/Private/BLAGameInstance.cpp`, `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`, `Source/BLA/Private/BLATestHarness.cpp`, `Scripts/Editor/build_task10_assets.py`, `Scripts/Editor/verify_task10_contracts.py`, `Source/BLA/Public/BLALanFlowTest.h`, `Source/BLA/Private/BLALanFlowTest.cpp`
- Test: `ABLALanFlowTest::RunUIAndCommandLineContracts()` plus `verify_task10_contracts`

**Interfaces:**
- Consumes: Task 1 `RequestHostLANMatch()`, `RequestJoinLANMatch(const FString&)`, `RequestLeaveLAN()`, `UBLALanStatics::GetAdvertiseIPv4()`, `ParseLANAddress`; Task 2 replicated `ABLAGameState`; Task 4 `StartLANMatch(APlayerController*)`, `ServerStartLANMatch()`; Task 5 `ClientNotifyFlowError(const FString&)`
- Produces:
  - `EBLA_UIScreen::LANWaiting` appended after `MatchResult`
  - `TSubclassOf<UUserWidget> ABLAUIManager::LANWaitingClass`
  - `bool ABLAUIManager::HostLANMatch();`
  - `bool ABLAUIManager::JoinLANMatch(const FString& Address);`
  - `bool ABLAUIManager::StartLANMatch();`
  - `bool ABLAUIManager::LeaveLAN();`
  - `FString ABLAUIManager::GetLANAdvertiseAddress() const;`
  - `ABLAGameState* ABLAUIManager::GetMatchState() const` reads world GameState on clients; on standalone/listen still prefers `RoundManager->BLAGameState` so existing graybox tests that spawn extra GameState actors keep working
  - Client HUD living counts use `ABLAGameState::{LivingAttackers,LivingDefenders}` when `RoundManager` is null
  - Unattended flags (non-Shipping only): `-BLALanHost`, `-BLALanJoin=IP`, `-BLALanTeam=Attackers|Defenders`, `-BLALanMode=Elimination|DataCore`, `-BLALanTeamSize=N`, `-BLALanAutoStart=Seconds`
  - `BLALanAutoStart` is never a Shipping menu widget
  - `ABLATestHarness` does not start the 18-config smoke when `-BLALanHost` or `-BLALanJoin=` is present
  - Packaged markers: `BLA_LAN_PACKAGED_HOST_WAITING`, `BLA_LAN_PACKAGED_CLIENT_JOINED`, `BLA_LAN_PACKAGED_TEAM`, `BLA_LAN_PACKAGED_STARTED`, `BLA_LAN_PACKAGED_STATE`, `BLA_LAN_PACKAGED_MENU`

- [ ] **Step 1: Write failing UI / command-line contracts**

```cpp
void ABLALanFlowTest::RunUIAndCommandLineContracts()
{
    ABLAUIManager* UI = Cast<ABLAUIManager>(UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    const ABLAGameState* WorldState = GetWorld()->GetGameState<ABLAGameState>();
    const ABLAGameState* UIState = UI ? UI->GetMatchState() : nullptr;
    const bool bSameState = UI && WorldState && UIState == WorldState;
    const bool bWaitingScreen = UI && UI->GetCurrentScreen() == EBLA_UIScreen::LANWaiting;
    const FString Advertised = UBLALanStatics::GetAdvertiseIPv4();
    const bool bHasIP = Advertised.Contains(TEXT("."));

    if (bSameState && bWaitingScreen && bHasIP)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_UI_OK screen=lan_waiting ip=%s world_gs=1"), *Advertised);
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_UI_FAILED screen=%d same_gs=%d ip=%s"),
            UI ? static_cast<int32>(UI->GetCurrentScreen()) : -1, bSameState ? 1 : 0, *Advertised);
    }
}
```

Call this on the listen Waiting world, before Start. Update `build_task10_assets.py` so a later editor run fails until `WBP_BLALANWaiting` exists and is assigned on `BP_BLAUIManager`.

- [ ] **Step 2: Run and confirm fail**

Expected: `BLA_LAN_UI_FAILED` because `LANWaiting` does not exist, `GetMatchState()` still prefers a server-only RoundManager pointer on clients, and Host/Join UI methods are missing.

- [ ] **Step 3: Implement UI, HUD source, network failure, and flags**

Enum — append only, do not reorder existing values:

```cpp
UENUM(BlueprintType)
enum class EBLA_UIScreen : uint8
{
    None,
    MainMenu,
    ModeSelect,
    Settings,
    MatchHUD,
    RoundResult,
    MatchResult,
    LANWaiting
};
```

Add next to `MatchResultClass`:

```cpp
UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
TSubclassOf<UUserWidget> LANWaitingClass;
```

Travel still goes through GameInstance. UI does not call `OpenLevel`.

```cpp
void ABLAUIManager::CopyFlowError(UBLAGameInstance* GI)
{
    LastErrorText = GI ? GI->LastFlowError : FString();
}

bool ABLAUIManager::HostLANMatch()
{
    UBLAGameInstance* GI = GetBLAGameInstance();
    if (!GI || !GI->RequestHostLANMatch())
    {
        CopyFlowError(GI);
        return false;
    }
    LastErrorText.Empty();
    return true;
}

bool ABLAUIManager::JoinLANMatch(const FString& Address)
{
    UBLAGameInstance* GI = GetBLAGameInstance();
    if (!GI || !GI->RequestJoinLANMatch(Address))
    {
        CopyFlowError(GI);
        return false;
    }
    LastErrorText.Empty();
    return true;
}

bool ABLAUIManager::StartLANMatch()
{
    ABLAPlayerController* PC = Cast<ABLAPlayerController>(
        GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr);
    if (!PC)
    {
        return false;
    }
    PC->ServerStartLANMatch();
    return true;
}

bool ABLAUIManager::LeaveLAN()
{
    UBLAGameInstance* GI = GetBLAGameInstance();
    return GI && GI->RequestLeaveLAN();
}

FString ABLAUIManager::GetLANAdvertiseAddress() const
{
    return UBLALanStatics::GetAdvertiseIPv4();
}
```

Extend Task 4 `StartLANMatch` so a non-host requestor is told about the error without leaving:

```cpp
if (!RequestorPS || !RequestorPS->bIsLANHost)
{
    if (GI)
    {
        GI->ReportFlowFailure(TEXT("FLOW_LAN_NOT_HOST"));
    }
    if (ABLAPlayerController* PC = Cast<ABLAPlayerController>(Requestor))
    {
        PC->ClientNotifyFlowError(TEXT("FLOW_LAN_NOT_HOST"));
    }
    return false;
}
```

Keep the Task 3 `SetLANTeam` TEAM_FULL path on the same pattern. The client stays in Waiting:

```cpp
if (PS->Team != Team && CountHumansOnTeam(Team) >= State->AttackersTeamSize)
{
    if (GI)
    {
        GI->ReportFlowFailure(TEXT("FLOW_LAN_TEAM_FULL"));
    }
    if (ABLAPlayerController* BLAPC = Cast<ABLAPlayerController>(PC))
    {
        BLAPC->ClientNotifyFlowError(TEXT("FLOW_LAN_TEAM_FULL"));
    }
    return false;
}
```

`CreateScreenWidget` / `ShowScreen`: add `case EBLA_UIScreen::LANWaiting: WidgetClass = LANWaitingClass; break;`.

`GetMatchState`:

```cpp
ABLAGameState* ABLAUIManager::GetMatchState() const
{
    if (GetWorld() && GetWorld()->GetNetMode() != NM_Client)
    {
        if (RoundManager && RoundManager->BLAGameState)
        {
            return RoundManager->BLAGameState;
        }
    }
    return GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
}
```

`RefreshHUD` living counts: if `RoundManager && RoundManager->TeamManager`, keep the current `GetLivingCount` math. Else use `GameState->LivingAttackers` / `LivingDefenders` relative to the local player's team. Scores, round, phase, and objective always come from `GetMatchState()`, never from a client-side RoundManager.

`EvaluateMatchScreens` must not jump to MatchHUD during Waiting:

```cpp
void ABLAUIManager::EvaluateMatchScreens()
{
    const ABLAGameState* GameState = GetMatchState();
    if (!GameState)
    {
        return;
    }
    if (GameState->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        if (CurrentScreen != EBLA_UIScreen::LANWaiting)
        {
            ShowScreen(EBLA_UIScreen::LANWaiting);
        }
        return;
    }
    const bool bMatchResult = GameState->RoundPhase == EBLA_RoundPhase::MatchResult;
    const bool bRoundResult = GameState->RoundPhase == EBLA_RoundPhase::RoundResult;
    const EBLA_UIScreen Target = bMatchResult ? EBLA_UIScreen::MatchResult
        : bRoundResult ? EBLA_UIScreen::RoundResult : EBLA_UIScreen::MatchHUD;
    if (CurrentScreen != Target)
    {
        ShowScreen(Target);
    }
}
```

On listen Waiting (`NetMode == NM_ListenServer` or `NM_Client`, `RoundPhase == Waiting`), `BeginPlay`/`Tick` shows `LANWaiting` instead of MatchHUD. After Start, `OpenMatchHUD()` as today.

`build_task10_assets.py`:
- append `"WBP_BLALANWaiting"` to `WIDGETS`
- add `"lan_waiting_class": "WBP_BLALANWaiting"` to `MANAGER_WIDGETS`
- leave the widget as a blank `UUserWidget`; C++ `HostLANMatch` / `JoinLANMatch` / `StartLANMatch` / `LeaveLAN` are the callable API. Do not put `OpenLevel` in the widget graph.

`verify_task10_contracts.py` must stay green inside the 25-check matrix:
- append `"WBP_BLALANWaiting"` to `WIDGETS`
- append `"lan_waiting_class"` to `MANAGER_WIDGETS`
- require `host_lan_match`, `join_lan_match`, `start_lan_match`, `leave_lan` on the UI manager CDO
- require `request_host_lan_match`, `request_join_lan_match`, `request_leave_lan` on the GameInstance CDO
- change the OK log to `widgets=12`

GameInstance network errors. Distinguish join failure from a live client losing the host:

```cpp
void UBLAGameInstance::HandleNetworkFailure(UWorld* World, UNetDriver* NetDriver,
    ENetworkFailure::Type FailureType, const FString& ErrorString)
{
    Super::HandleNetworkFailure(World, NetDriver, FailureType, ErrorString);
    const bool bWasConnectedClient = World && World->GetNetMode() == NM_Client
        && World->GetGameState() != nullptr;
    if (bWasConnectedClient
        && (FailureType == ENetworkFailure::ConnectionLost
            || FailureType == ENetworkFailure::FailureReceived))
    {
        ReportFlowFailure(TEXT("FLOW_LAN_HOST_LEFT"), ErrorString);
    }
    else
    {
        ReportFlowFailure(TEXT("FLOW_LAN_CONNECT_FAILED"), ErrorString);
    }
    RequestLeaveLAN();
}
```

If `RequestHostLANMatch` loads the map but `GetWorld()->GetNetDriver()` is null on the listen instance, `ReportFlowFailure(TEXT("FLOW_LAN_LISTEN_FAILED"))` and `RequestLeaveLAN()`.

Command line (non-Shipping). Parse in `UBLAGameInstance::Init`:

```cpp
void UBLAGameInstance::Init()
{
    Super::Init();
#if !UE_BUILD_SHIPPING
    const TCHAR* Cmd = FCommandLine::Get();
    bLanHostRequested = FParse::Param(Cmd, TEXT("BLALanHost"));
    FParse::Value(Cmd, TEXT("BLALanJoin="), LanJoinAddress);
    FParse::Value(Cmd, TEXT("BLALanTeam="), LanTeamName);
    FParse::Value(Cmd, TEXT("BLALanMode="), LanModeName);
    FParse::Value(Cmd, TEXT("BLALanTeamSize="), LanTeamSizeOverride);
    FParse::Value(Cmd, TEXT("BLALanAutoStart="), LanAutoStartSeconds);
    if (bLanHostRequested || !LanJoinAddress.IsEmpty())
    {
        MatchMapPath = TEXT("/Game/BLA/Maps/Final/L_BLA_ZeroFacility");
    }
#endif
}
```

Add those six members to `UBLAGameInstance`. Do not add Shipping UI for AutoStart.

On first menu world (`OnWorldChanged`), if `bLanHostRequested`, apply mode/size then `RequestHostLANMatch()`. If `LanJoinAddress` is set, `RequestJoinLANMatch(LanJoinAddress)`. After join, if `LanTeamName` is `Defenders` or `Attackers`, the local player calls `ServerSetTeam` once PlayerState exists.

Mode parse: `DataCore` -> `EBLA_MatchMode::DataCoreAttackDefense`, anything else -> `TeamElimination`. Team size clamp 1..3 via existing `ApplyTeamSize`.

AutoStart: on listen Waiting, if `LanAutoStartSeconds > 0`, the host GameMode sets a timer and calls `StartLANMatch(GetWorld()->GetFirstPlayerController())`. Do not expose this timer on the Shipping menu.

Packaged/unattended log lines (`#if !UE_BUILD_SHIPPING`), emitted once each:

```cpp
UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_HOST_WAITING ip=%s port=7777"), *UBLALanStatics::GetAdvertiseIPv4());
UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_CLIENT_JOINED"));
UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_TEAM team=%s"), *StaticEnum<EBLA_Team>()->GetNameStringByValue((int64)PS->Team));
UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_STARTED phase=%d humans=%d bots=%d total=%d"),
    static_cast<int32>(State->RoundPhase), HumanCount, BotCount, HumanCount + BotCount);
UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_STATE net=%d phase=%d attack_score=%d defend_score=%d living_a=%d living_d=%d"),
    static_cast<int32>(GetWorld()->GetNetMode()), static_cast<int32>(State->RoundPhase),
    State->AttackersScore, State->DefendersScore, State->LivingAttackers, State->LivingDefenders);
UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_MENU"));
```

Emit `HOST_WAITING` from `EnterLANWaiting`. Emit `CLIENT_JOINED` from client `PostLogin` path once PlayerState exists (client can log from UIManager when `NM_Client` and Waiting). Emit `TEAM` from `SetLANTeam` after a successful assign. Emit `STARTED` from `StartLANMatch` after `LaunchPreparedMatch`. Emit `STATE` from UIManager Tick the first time `RoundPhase != Waiting`. Emit `MENU` when `RequestLeaveLAN` reaches `MenuMapPath`.

`ABLATestHarness::BeginPlay` first-entry smoke gate. `FParse::Param` does not match `-BLALanJoin=IP`, so use `Value`:

```cpp
FString LanJoin;
if (FParse::Param(FCommandLine::Get(), TEXT("BLALanHost"))
    || FParse::Value(FCommandLine::Get(), TEXT("BLALanJoin="), LanJoin))
{
    return;
}
```

Keep the existing `-BLASmokeTest` path unchanged when those flags are absent.

- [ ] **Step 4: Generate the widget and run UI contracts**

```powershell
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force
pwsh -File Scripts/run_verification.ps1 -Only verify_task10_contracts -Tag lan-task6
```

Then host Waiting and expect `BLA_LAN_UI_OK screen=lan_waiting ip=... world_gs=1`. `verify_task10_contracts` must still pass so the default 25-check matrix stays green.

- [ ] **Step 5: Commit**

```powershell
git add Source/BLA/Public/BLAUIManager.h Source/BLA/Private/BLAUIManager.cpp Source/BLA/Public/BLAGameInstance.h Source/BLA/Private/BLAGameInstance.cpp Source/BLA/Public/BLAGameModeElimination.h Source/BLA/Private/BLAGameModeElimination.cpp Source/BLA/Private/BLATestHarness.cpp Scripts/Editor/build_task10_assets.py Scripts/Editor/verify_task10_contracts.py Source/BLA/Public/BLALanFlowTest.h Source/BLA/Private/BLALanFlowTest.cpp
git commit -m "feat: add LAN waiting UI and test flags"
```

---

### Task 7: PIE listen+client, packaged dual-process smoke, offline matrix

**Files:**
- Create: `Scripts/Editor/verify_lan_pie.py` (replace any Task 1 stub), `Scripts/run_lan_packaged_smoke.ps1`, `docs/builds/lan-listen-server-smoke-2026-09-15.md`, `docs/superpowers/sdd/2026-09-15-lan-listen-server/progress.md`
- Modify: `Source/BLA/Public/BLALanStatics.h`, `Source/BLA/Private/BLALanStatics.cpp`, `Source/BLA/Public/BLAGameModeElimination.h`, `Source/BLA/Private/BLAGameModeElimination.cpp`, `Source/BLA/Public/BLAPlayerController.h`, `Source/BLA/Private/BLAPlayerController.cpp`, `Source/BLA/Public/BLAGameInstance.h`, `Source/BLA/Private/BLAGameInstance.cpp`, `Source/BLA/Public/BLAPlayerState.h`, `Scripts/run_verification.ps1`, `README.md`, `Source/BLA/BLA.Build.cs` (add `Sockets` if Task 1 did not)
- Test: `Scripts/Editor/verify_lan_pie.py`, `Scripts/run_lan_packaged_smoke.ps1`, default `Scripts/run_verification.ps1` 25-check matrix

**Interfaces:**
- Consumes: Task 1 `RequestHostLANMatch` / `RequestJoinLANMatch` / `RequestLeaveLAN` / `RequestStartMatch`; Task 2 `Waiting` + replicated GameState/PlayerState; Task 3 `CanAcceptLANJoin` / `CountHumans` / `CountHumansOnTeam` / `SetLANTeam` / `ServerSetTeam`; Task 4 `StartLANMatch(APlayerController*)` / `ServerStartLANMatch`; Task 5 `ApplyDamage` authority no-op + `ClientNotifyFlowError` leave codes (`HOST_LEFT` / `JOIN_REJECTED_*` / `CONNECT_FAILED` / `LISTEN_FAILED` leave; `NOT_HOST` / `TEAM_FULL` stay); Task 6 packaged flags and `BLA_LAN_PACKAGED_*` markers
- Produces:
  - `static TArray<UWorld*> UBLALanStatics::GetPlayWorlds();` (`UFUNCTION(BlueprintCallable)`). Parent class is `UBlueprintFunctionLibrary`.
  - `void ABLAPlayerController::ClientDebugTryLocalDamage(float Amount);` (`UFUNCTION(BlueprintCallable)`). Shipping body is a no-op. Must never call `RequestLeaveLAN`.
  - Public `UFUNCTION(BlueprintCallable)`: `CanAcceptLANJoin`, `CountHumans`, `CountHumansOnTeam`, `SetLANTeam`, `StartLANMatch`, `ServerSetTeam`, `ServerStartLANMatch`, `RequestHostLANMatch`, `RequestJoinLANMatch`, `RequestLeaveLAN`.
  - `Scripts/run_verification.ps1` extra `$lanMatrix` used only when `-Only` hits `verify_lan_contracts` or `verify_lan_pie`. Default matrix stays 25 checks.
  - PIE markers: `BLA_LAN_PIE_WAITING_OK`, `BLA_LAN_PIE_JOIN_OK`, `BLA_LAN_PIE_TEAM_OK`, `BLA_LAN_PIE_FULL_REJECT_OK`, `BLA_LAN_PIE_NOT_HOST_OK`, `BLA_LAN_PIE_START_OK`, `BLA_LAN_PIE_STARTED_REJECT_OK`, `BLA_LAN_PIE_CLIENT_DAMAGE_OK`, `BLA_LAN_PIE_HOST_LEFT_OK`, `BLA_LAN_PIE_STANDALONE_OK`, plus one driver marker `BLA_LAN_PIE_DRIVER_OK`.

Hard constraints for this task:
- One `UnrealEditor-Cmd` process. `RunUnderOneProcess=True`. `LaunchSeparateServer=False`.
- LAN PIE map is `/Game/BLA/Maps/Final/L_BLA_ZeroFacility`.
- Restore play settings before quitting so the offline 25-check PIE drivers stay standalone.
- Do not add LAN scripts to the default `$matrix`.
- Do not change `ai_attacker_carry`.

- [ ] **Step 1: Write the failing PIE driver, runner hook, and packaged smoke script**

Replace any Task 1 stub with this full driver.

```python
import unreal

MATCH_MAP = "/Game/BLA/Maps/Final/L_BLA_ZeroFacility"
MENU_MAP = "/Game/BLA/Maps/Graybox/L_TestBootstrap"
MAX_TICKS = 18000

level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
play_settings = unreal.get_default_object(unreal.LevelEditorPlaySettings)
original_play = {
    "play_net_mode": play_settings.get_editor_property("play_net_mode"),
    "play_number_of_clients": play_settings.get_editor_property("play_number_of_clients"),
    "run_under_one_process": play_settings.get_editor_property("run_under_one_process"),
    "launch_separate_server": play_settings.get_editor_property("launch_separate_server"),
}

state = {
    "ticks": 0,
    "phase": "boot",
    "wait": 0,
    "ending": False,
    "health_before": None,
    "markers": [],
    "rpc_wait": 0,
    "rpc_sent": False,
    "extra_pc": None,
}
handle = None


def restore_play_settings():
    for key, value in original_play.items():
        play_settings.set_editor_property(key, value)


def finish(success, message):
    restore_play_settings()
    log = unreal.log if success else unreal.log_error
    suffix = "OK" if success else "FAILED"
    log("BLA_LAN_PIE_DRIVER_%s %s markers=%s" % (suffix, message, ",".join(state["markers"])))
    state["ending"] = True
    if level.is_in_play_in_editor():
        level.editor_request_end_play()
    else:
        unreal.unregister_slate_post_tick_callback(handle)
        unreal.SystemLibrary.quit_editor()


def mark(name):
    if name not in state["markers"]:
        state["markers"].append(name)
        unreal.log(name)


def set_listen_play():
    play_settings.set_editor_property("play_net_mode", unreal.PlayNetMode.PIE_LISTEN_SERVER)
    play_settings.set_editor_property("play_number_of_clients", 2)
    play_settings.set_editor_property("run_under_one_process", True)
    play_settings.set_editor_property("launch_separate_server", False)


def set_standalone_play():
    play_settings.set_editor_property("play_net_mode", unreal.PlayNetMode.PIE_STANDALONE)
    play_settings.set_editor_property("play_number_of_clients", 1)
    play_settings.set_editor_property("run_under_one_process", True)
    play_settings.set_editor_property("launch_separate_server", False)


def set_team_size(size):
    editor_world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    gi = unreal.GameplayStatics.get_game_instance(editor_world)
    gi.set_editor_property("selected_team_size", size)
    gi.set_editor_property("match_map_path", MATCH_MAP)
    gi.apply_team_size(size)


def get_worlds():
    return list(unreal.BLALanStatics.get_play_worlds())


def split_worlds(worlds):
    listen = None
    client = None
    for world in worlds:
        if unreal.GameplayStatics.get_game_mode(world):
            listen = world
        else:
            client = world
    return listen, client


def get_pc(world):
    return unreal.GameplayStatics.get_player_controller(world, 0)


def get_gs(world):
    return unreal.GameplayStatics.get_game_state(world)


def prop(obj, name, default=None):
    if obj is None:
        return default
    try:
        return obj.get_editor_property(name)
    except Exception:
        return default


def health_of(pc):
    pawn = pc.get_pawn() if pc else None
    if pawn is None:
        return None
    component = prop(pawn, "health_component")
    if component is None:
        return None
    return prop(component, "current_health")


def begin_listen(team_size, next_phase):
    if not level.load_level(MATCH_MAP):
        finish(False, "failed to load match map")
        return
    set_team_size(team_size)
    set_listen_play()
    state["phase"] = next_phase
    state["wait"] = 0
    level.editor_request_begin_play()


def begin_standalone():
    if not level.load_level(MENU_MAP):
        finish(False, "failed to load menu map")
        return
    set_team_size(1)
    set_standalone_play()
    state["phase"] = "standalone_play"
    state["wait"] = 0
    level.editor_request_begin_play()


def request_end(next_phase):
    state["phase"] = next_phase
    state["wait"] = 0
    if level.is_in_play_in_editor():
        level.editor_request_end_play()


def tick_impl():
    state["ticks"] += 1
    if state["ending"]:
        if not level.is_in_play_in_editor():
            restore_play_settings()
            unreal.unregister_slate_post_tick_callback(handle)
            unreal.SystemLibrary.quit_editor()
        return
    if state["ticks"] >= MAX_TICKS:
        finish(False, "timeout phase=%s" % state["phase"])
        return

    phase = state["phase"]
    if phase == "boot":
        begin_listen(1, "s1_wait_worlds")
        return

    if phase in ("s1_end", "s2_end"):
        if not level.is_in_play_in_editor():
            if phase == "s1_end":
                begin_listen(2, "s2_wait_worlds")
            else:
                begin_standalone()
        return

    if not level.is_in_play_in_editor():
        state["wait"] += 1
        if state["wait"] > 600:
            finish(False, "PIE did not start phase=%s" % phase)
        return

    worlds = get_worlds()
    listen, client = split_worlds(worlds)

    if phase == "s1_wait_worlds":
        if listen is None or client is None:
            return
        gs = get_gs(listen)
        if prop(gs, "round_phase") != unreal.BLA_RoundPhase.WAITING:
            return
        bots = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLABotCharacter)
        if len(bots) != 0:
            finish(False, "waiting spawned bots")
            return
        mark("BLA_LAN_PIE_WAITING_OK")
        state["phase"] = "s1_join"
        return

    if phase == "s1_join":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        client_pc = get_pc(client)
        client_ps = client_pc.player_state if client_pc else None
        if gm is None or client_ps is None:
            return
        if gm.count_humans() < 2:
            return
        if prop(client_ps, "team") != unreal.BLA_Team.NEUTRAL:
            finish(False, "joiner was not Neutral")
            return
        mark("BLA_LAN_PIE_JOIN_OK")
        state["phase"] = "s1_team"
        return

    if phase == "s1_team":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        host_pc = get_pc(listen)
        client_pc = get_pc(client)
        host_ps = host_pc.player_state if host_pc else None
        client_ps = client_pc.player_state if client_pc else None
        if gm is None or host_ps is None or client_ps is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            gm.set_lan_team(host_pc, unreal.BLA_Team.ATTACKERS)
            client_pc.server_set_team(unreal.BLA_Team.ATTACKERS)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        if wait == 3:
            if prop(client_ps, "team") == unreal.BLA_Team.ATTACKERS:
                finish(False, "second attacker was accepted at TeamSize=1")
                return
            client_pc.server_set_team(unreal.BLA_Team.DEFENDERS)
            state["rpc_wait"] = 4
            return
        if wait < 6:
            state["rpc_wait"] = wait + 1
            return
        if prop(client_ps, "team") != unreal.BLA_Team.DEFENDERS:
            finish(False, "team pick failed")
            return
        mark("BLA_LAN_PIE_TEAM_OK")
        state["phase"] = "s1_full"
        state["rpc_wait"] = 0
        return

    if phase == "s1_full":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        if gm is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            state["extra_pc"] = unreal.GameplayStatics.create_player(listen, 2, True)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        accepted = gm.can_accept_lan_join()
        humans = gm.count_humans()
        extra = state.get("extra_pc")
        if extra:
            unreal.GameplayStatics.remove_player(extra, True)
            state["extra_pc"] = None
        if accepted or humans != 2:
            finish(False, "third join not rejected humans=%s accepted=%s" % (humans, accepted))
            return
        mark("BLA_LAN_PIE_FULL_REJECT_OK")
        state["phase"] = "s1_not_host"
        state["rpc_wait"] = 0
        return

    if phase == "s1_not_host":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        gs = get_gs(listen)
        client_pc = get_pc(client)
        client_gi = unreal.GameplayStatics.get_game_instance(client)
        if gm is None or gs is None or client_pc is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            client_pc.server_start_lan_match()
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        still_waiting = prop(gs, "round_phase") == unreal.BLA_RoundPhase.WAITING
        error = str(prop(client_gi, "last_flow_error", ""))
        if not still_waiting:
            finish(False, "non-host start left Waiting")
            return
        if "FLOW_LAN_NOT_HOST" not in error:
            if wait < 30:
                state["rpc_wait"] = wait + 1
                return
            finish(False, "non-host start missing FLOW_LAN_NOT_HOST")
            return
        mark("BLA_LAN_PIE_NOT_HOST_OK")
        state["phase"] = "s1_host_left"
        state["rpc_wait"] = 0
        return

    if phase == "s1_host_left":
        listen_gi = unreal.GameplayStatics.get_game_instance(listen) if listen else None
        client_gi = unreal.GameplayStatics.get_game_instance(client) if client else None
        if listen_gi is None:
            return
        listen_gi.request_leave_lan()
        state["phase"] = "s1_host_left_wait"
        state["wait"] = 0
        return

    if phase == "s1_host_left_wait":
        state["wait"] += 1
        client_gi = unreal.GameplayStatics.get_game_instance(client) if client else None
        error = str(prop(client_gi, "last_flow_error", "")) if client_gi else ""
        client_map = client.get_path_name() if client else ""
        left = ("FLOW_LAN_HOST_LEFT" in error) or ("L_TestBootstrap" in client_map) or (client is None)
        if left:
            mark("BLA_LAN_PIE_HOST_LEFT_OK")
            request_end("s1_end")
            return
        if state["wait"] > 600:
            finish(False, "host leave did not return client")
        return

    if phase == "s2_wait_worlds":
        if listen is None or client is None:
            return
        gs = get_gs(listen)
        gm = unreal.GameplayStatics.get_game_mode(listen)
        if prop(gs, "round_phase") != unreal.BLA_RoundPhase.WAITING or gm is None:
            return
        if gm.count_humans() < 2:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            host_pc = get_pc(listen)
            client_pc = get_pc(client)
            gm.set_lan_team(host_pc, unreal.BLA_Team.ATTACKERS)
            client_pc.server_set_team(unreal.BLA_Team.DEFENDERS)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        state["phase"] = "s2_start"
        state["wait"] = 0
        state["rpc_wait"] = 0
        return

    if phase == "s2_start":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        gs = get_gs(listen)
        host_pc = get_pc(listen)
        client_ps = get_pc(client).player_state if get_pc(client) else None
        if gm is None or host_pc is None or client_ps is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            if prop(client_ps, "team") != unreal.BLA_Team.DEFENDERS:
                finish(False, "s2 team pick failed")
                return
            gm.start_lan_match(host_pc)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        state["wait"] += 1
        if prop(gs, "round_phase") == unreal.BLA_RoundPhase.WAITING:
            if state["wait"] < 180:
                return
            finish(False, "start did not leave Waiting")
            return
        bots = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLABotCharacter)
        units = unreal.GameplayStatics.get_all_actors_of_class(listen, unreal.BLACharacterBase)
        if len(bots) != 2 or len(units) != 4:
            if state["wait"] < 180:
                return
            finish(False, "start fill failed bots=%s total=%s" % (len(bots), len(units)))
            return
        mark("BLA_LAN_PIE_START_OK")
        state["phase"] = "s2_started_reject"
        state["wait"] = 0
        state["rpc_wait"] = 0
        return

    if phase == "s2_started_reject":
        gm = unreal.GameplayStatics.get_game_mode(listen)
        if gm is None:
            return
        wait = state.get("rpc_wait", 0)
        if wait == 0:
            state["extra_pc"] = unreal.GameplayStatics.create_player(listen, 2, True)
            state["rpc_wait"] = 1
            return
        if wait < 3:
            state["rpc_wait"] = wait + 1
            return
        accepted = gm.can_accept_lan_join()
        extra = state.get("extra_pc")
        if extra:
            unreal.GameplayStatics.remove_player(extra, True)
            state["extra_pc"] = None
        if accepted:
            finish(False, "join after start was accepted")
            return
        mark("BLA_LAN_PIE_STARTED_REJECT_OK")
        state["phase"] = "s2_damage"
        state["wait"] = 0
        state["rpc_wait"] = 0
        return

    if phase == "s2_damage":
        client_pc = get_pc(client)
        hp = health_of(client_pc)
        if hp is None:
            return
        if state["health_before"] is None:
            state["health_before"] = hp
            client_pc.client_debug_try_local_damage(25.0)
            return
        if hp != state["health_before"]:
            finish(False, "client local damage applied hp=%s before=%s" % (hp, state["health_before"]))
            return
        mark("BLA_LAN_PIE_CLIENT_DAMAGE_OK")
        request_end("s2_end")
        return

    if phase == "standalone_play":
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
        if world is None:
            return
        gi = unreal.GameplayStatics.get_game_instance(world)
        if not state.get("rpc_sent"):
            gi.set_editor_property("match_map_path", MATCH_MAP)
            gi.request_start_match()
            state["rpc_sent"] = True
            travel = str(prop(gi, "last_travel_request", ""))
            if "?listen" in travel:
                finish(False, "standalone travel had listen url=%s" % travel)
                return
            return
        travel = str(prop(gi, "last_travel_request", ""))
        if "?listen" in travel:
            finish(False, "standalone travel had listen url=%s" % travel)
            return
        state["phase"] = "standalone_wait"
        state["wait"] = 0
        return

    if phase == "standalone_wait":
        world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
        if world is None:
            return
        gs = get_gs(world)
        gm = unreal.GameplayStatics.get_game_mode(world)
        if gs is None:
            return
        phase_now = prop(gs, "round_phase")
        if phase_now == unreal.BLA_RoundPhase.WAITING:
            finish(False, "standalone entered Waiting")
            return
        if phase_now in (unreal.BLA_RoundPhase.PREPARATION, unreal.BLA_RoundPhase.COMBAT):
            if gm is not None:
                mark("BLA_LAN_PIE_STANDALONE_OK")
                required = [
                    "BLA_LAN_PIE_WAITING_OK",
                    "BLA_LAN_PIE_JOIN_OK",
                    "BLA_LAN_PIE_TEAM_OK",
                    "BLA_LAN_PIE_FULL_REJECT_OK",
                    "BLA_LAN_PIE_NOT_HOST_OK",
                    "BLA_LAN_PIE_START_OK",
                    "BLA_LAN_PIE_STARTED_REJECT_OK",
                    "BLA_LAN_PIE_CLIENT_DAMAGE_OK",
                    "BLA_LAN_PIE_HOST_LEFT_OK",
                    "BLA_LAN_PIE_STANDALONE_OK",
                ]
                missing = [name for name in required if name not in state["markers"]]
                if missing:
                    finish(False, "missing %s" % ",".join(missing))
                    return
                finish(True, "sessions=3")
                return
        state["wait"] += 1
        if state["wait"] > 900:
            finish(False, "standalone did not start phase=%s" % phase_now)
        return


def tick(_):
    try:
        tick_impl()
    except Exception as error:
        finish(False, "driver_error %s" % error)


handle = unreal.register_slate_post_tick_callback(tick)
unreal.log("BLA_LAN_PIE_DRIVER_STARTED")
```

The driver starts three PIE sessions in one editor process, ending play between them. `GetPlayWorlds()` distinguishes listen vs client: the world with a GameMode is the listen server. `RunUnderOneProcess=True` is mandatory; a False value launches a second editor. After `ServerSetTeam` / `ServerStartLANMatch` / `create_player` / `RequestLeaveLAN`, wait 1-3 ticks before reading replicated `Team`, `LastFlowError`, or `RoundPhase`. Call `create_player` and each RPC once per check, not every tick.

Hook LAN-only entries in `Scripts/run_verification.ps1` **after** `$matrix` is defined and **before** the `foreach`. Do not append them to `$matrix`:

```powershell
$lanMatrix = @(
    @{ Script = "verify_lan_contracts"; Marker = "BLA_LAN_CONTRACTS_(OK|FAILED)"; FailPattern = "BLA_LAN_CONTRACTS_FAILED|LAN_CONTRACT_FAILURE" }
    @{ Script = "verify_lan_pie"; Marker = "BLA_LAN_PIE_DRIVER_(OK|FAILED)"; Require = @("BLA_LAN_PIE_WAITING_OK","BLA_LAN_PIE_JOIN_OK","BLA_LAN_PIE_TEAM_OK","BLA_LAN_PIE_FULL_REJECT_OK","BLA_LAN_PIE_NOT_HOST_OK","BLA_LAN_PIE_START_OK","BLA_LAN_PIE_STARTED_REJECT_OK","BLA_LAN_PIE_CLIENT_DAMAGE_OK","BLA_LAN_PIE_HOST_LEFT_OK","BLA_LAN_PIE_STANDALONE_OK") }
)

$runMatrix = $matrix
if ($Only -ne "") {
    $runMatrix = @($matrix + $lanMatrix) | Where-Object { $_.Script -eq $Only }
}
```

Change the existing `foreach ($entry in $matrix)` to `foreach ($entry in $runMatrix)` and delete the old `-Only` skip inside the loop (the filter already happened). Empty `-Only` still runs only `$matrix` (25 checks). Do not modify the existing `$Soak` block after the loop.

Create `Scripts/run_lan_packaged_smoke.ps1`:

```powershell
[CmdletBinding()]
param(
    [string]$EngineRoot = "D:\Epic Games\UE_5.8",
    [string]$ArchiveDir = "D:\dev\BLA-Packaged",
    [string]$ExePath = "D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe",
    [string]$Tag = (Get-Date -Format "MMdd-HHmmss"),
    [int]$TimeoutSeconds = 180,
    [switch]$SkipCook
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$uat = Join-Path $EngineRoot "Engine\Build\BatchFiles\RunUAT.bat"
$project = Join-Path $root "BlackarmsLibertyAmerica.uproject"
$logDir = Join-Path $root "Saved\Logs"
if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }

function Stop-BLA {
    Get-Process BlackarmsLibertyAmerica -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

function Wait-Marker([string]$LogPath, [string]$Pattern, [int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 2
        if ((Test-Path $LogPath) -and (Select-String -Path $LogPath -Pattern $Pattern -Quiet)) {
            return (Select-String -Path $LogPath -Pattern $Pattern | Select-Object -Last 1).Line.Trim()
        }
    }
    throw "NO_MARKER $Pattern log=$LogPath"
}

Stop-BLA
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

if (-not $SkipCook) {
    & $uat BuildCookRun -project="$project" -noP4 -platform=Win64 -clientconfig=Development -cook "-map=+/Game/BLA/Maps/Graybox/L_TestBootstrap+/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination+/Game/BLA/Maps/Final/L_BLA_ZeroFacility" -build -stage -pak -archive "-archivedirectory=$ArchiveDir" -utf8output -nocompileeditor
    if ($LASTEXITCODE -ne 0) { throw "COOK_FAILED exit=$LASTEXITCODE" }
}

if (-not (Test-Path $ExePath)) { throw "Missing packaged exe $ExePath" }

$hostLog = Join-Path $logDir ("LAN_HOST_" + $Tag + ".log")
$clientLog = Join-Path $logDir ("LAN_CLIENT_" + $Tag + ".log")
$hostArgs = '-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5 -nullrhi -nosound -unattended -abslog="{0}"' -f $hostLog
$clientArgs = '-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended -abslog="{0}"' -f $clientLog

$hostProc = Start-Process -FilePath $ExePath -ArgumentList $hostArgs -PassThru -WindowStyle Hidden
Wait-Marker $hostLog "BLA_LAN_PACKAGED_HOST_WAITING" 60
$clientProc = Start-Process -FilePath $ExePath -ArgumentList $clientArgs -PassThru -WindowStyle Hidden
Wait-Marker $clientLog "BLA_LAN_PACKAGED_CLIENT_JOINED" 60
Wait-Marker $clientLog "BLA_LAN_PACKAGED_TEAM" 30
Wait-Marker $hostLog "BLA_LAN_PACKAGED_STARTED" 30
Wait-Marker $clientLog "BLA_LAN_PACKAGED_STARTED" 30
$hostState = Wait-Marker $hostLog "BLA_LAN_PACKAGED_STATE" 30
$clientState = Wait-Marker $clientLog "BLA_LAN_PACKAGED_STATE" 30
if ($hostState -notmatch "phase=" -or $clientState -notmatch "phase=") { throw "STATE_MISSING" }

Stop-Process -Id $clientProc.Id -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
if ($hostProc.HasExited) { throw "HOST_DIED_AFTER_CLIENT_KILL" }
if (Select-String -Path $hostLog -Pattern "BLA_LAN_PACKAGED_MENU" -Quiet) { throw "HOST_RETURNED_TO_MENU_AFTER_CLIENT_LEAVE" }
Stop-BLA

$hostLog2 = Join-Path $logDir ("LAN_HOST2_" + $Tag + ".log")
$clientLog2 = Join-Path $logDir ("LAN_CLIENT2_" + $Tag + ".log")
$hostArgs2 = '-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -nullrhi -nosound -unattended -abslog="{0}"' -f $hostLog2
$clientArgs2 = '-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended -abslog="{0}"' -f $clientLog2
$hostProc = Start-Process -FilePath $ExePath -ArgumentList $hostArgs2 -PassThru -WindowStyle Hidden
Wait-Marker $hostLog2 "BLA_LAN_PACKAGED_HOST_WAITING" 60
$clientProc = Start-Process -FilePath $ExePath -ArgumentList $clientArgs2 -PassThru -WindowStyle Hidden
Wait-Marker $clientLog2 "BLA_LAN_PACKAGED_CLIENT_JOINED" 60
Stop-Process -Id $hostProc.Id -Force -ErrorAction SilentlyContinue
Wait-Marker $clientLog2 "FLOW_LAN_HOST_LEFT" 30
Wait-Marker $clientLog2 "BLA_LAN_PACKAGED_MENU" 30
Stop-BLA
Write-Host "BLA_LAN_PACKAGED_SMOKE_OK tag=$Tag"
```

The first packaged pair uses AutoStart so both sides reach `STARTED`/`STATE`. The second pair omits AutoStart and kills the host while still in Waiting. Always recook: Tasks 1-6 changed C++. Use the same RunUAT command as `docs/builds/windows-mvp-smoke-test.md`.

- [ ] **Step 2: Run the PIE driver and confirm it fails**

```powershell
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -Tag lan-task7 -TimeoutSeconds 420
```

Expected: `BLA_LAN_PIE_DRIVER_FAILED` because `GetPlayWorlds` / public BlueprintCallable LAN API / `ClientDebugTryLocalDamage` do not exist yet, or the Task 1 stub never starts listen+2. Do not run packaged smoke until Step 5.

- [ ] **Step 3: Implement PIE helpers and public LAN API**

If `Source/BLA/BLA.Build.cs` does not list `Sockets`, add it next to `Engine` (needed by Task 1 `GetAdvertiseIPv4`).

`BLALanStatics.h` must be a function library and expose play worlds:

```cpp
#pragma once
#include "Kismet/BlueprintFunctionLibrary.h"
#include "BLALanStatics.generated.h"

USTRUCT(BlueprintType)
struct BLA_API FBLALanAddress
{
    GENERATED_BODY()
    UPROPERTY(BlueprintReadOnly, Category="BLA|LAN")
    FString Host;
    UPROPERTY(BlueprintReadOnly, Category="BLA|LAN")
    int32 Port = 7777;
    UPROPERTY(BlueprintReadOnly, Category="BLA|LAN")
    bool bValid = false;
};

UCLASS()
class BLA_API UBLALanStatics : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
public:
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static bool ParseLANAddress(const FString& Address, FBLALanAddress& OutAddress, FString& OutErrorCode);
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static FString BuildListenMapURL(const FString& MapPath, int32 Port = 7777);
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static FString GetAdvertiseIPv4();
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    static TArray<UWorld*> GetPlayWorlds();
};
```

If Task 1 already declared `FBLALanAddress` / the first three methods, keep those signatures exactly and only add `GetPlayWorlds` plus the `UBlueprintFunctionLibrary` parent.

```cpp
#include "Engine/Engine.h"
#include "Engine/World.h"

TArray<UWorld*> UBLALanStatics::GetPlayWorlds()
{
    TArray<UWorld*> Worlds;
    if (GEngine == nullptr)
    {
        return Worlds;
    }
    for (const FWorldContext& Context : GEngine->GetWorldContexts())
    {
        if (Context.World() && (Context.WorldType == EWorldType::PIE || Context.WorldType == EWorldType::Game))
        {
            Worlds.Add(Context.World());
        }
    }
    return Worlds;
}
```

Make GameMode LAN methods public and Python-callable. If Task 3/4 left them private, move them:

```cpp
public:
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    bool CanAcceptLANJoin() const;
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    int32 CountHumans() const;
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    int32 CountHumansOnTeam(EBLA_Team Team) const;
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    bool SetLANTeam(APlayerController* PC, EBLA_Team Team);
    UFUNCTION(BlueprintCallable, Category="BLA|LAN")
    bool StartLANMatch(APlayerController* Requestor);
    void FillVacantLANSlotsWithBots();
    void RefreshLANRoster();
```

Do not change the Task 4 `StartLANMatch` body. Non-host still reports `FLOW_LAN_NOT_HOST` and, from Task 6, calls `ClientNotifyFlowError` without leaving.

PlayerController RPCs and the PIE-only damage probe:

```cpp
UFUNCTION(Server, Reliable, BlueprintCallable, Category="BLA|LAN")
void ServerSetTeam(EBLA_Team Team);
UFUNCTION(Server, Reliable, BlueprintCallable, Category="BLA|LAN")
void ServerStartLANMatch();
UFUNCTION(BlueprintCallable, Category="BLA|LAN|Debug")
void ClientDebugTryLocalDamage(float Amount);

void ABLAPlayerController::ClientDebugTryLocalDamage(float Amount)
{
#if UE_BUILD_SHIPPING
    return;
#else
    ABLACharacterBase* Victim = Cast<ABLACharacterBase>(GetPawn());
    if (Victim && Victim->HealthComponent)
    {
        Victim->HealthComponent->ApplyDamage(Amount, TEXT("Debug"), this);
    }
#endif
}
```

UHT needs the `UFUNCTION` visible in all configs; the Shipping body is a no-op. This method must not call `RequestLeaveLAN` or change teams.

GameInstance LAN entry points must be callable from Python:

```cpp
UFUNCTION(BlueprintCallable, Category="BLA|LAN")
bool RequestHostLANMatch();
UFUNCTION(BlueprintCallable, Category="BLA|LAN")
bool RequestJoinLANMatch(const FString& Address);
UFUNCTION(BlueprintCallable, Category="BLA|LAN")
bool RequestLeaveLAN();
```

`ABLAPlayerState::bIsLANHost` and `Team` stay `BlueprintReadOnly`/`BlueprintReadWrite` as Task 2 defined so the PIE driver can read them. Do not add a new `bLANMatchStarted` flag; `RoundPhase != Waiting` remains the gate.

RPC results are not instant. The PIE driver may wait a few ticks after `ServerSetTeam` / `ServerStartLANMatch` / `RequestLeaveLAN`. If a same-tick assertion flakes, wait for the replicated `PlayerState.Team` / `LastFlowError` / `RoundPhase` instead of adding sleeps in C++.

- [ ] **Step 4: Re-run LAN PIE until every required marker is present**

```powershell
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -Tag lan-task7-pass -TimeoutSeconds 420
```

Expected driver line: `BLA_LAN_PIE_DRIVER_OK sessions=3`. The runner `Require` list must all appear in the same log. `verify_lan_contracts` should still pass:

```powershell
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_contracts -Tag lan-task7-contracts
```

- [ ] **Step 5: Recook and run the packaged dual-process smoke**

Do not start this while `UnrealEditor-Cmd` is running.

```powershell
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force
pwsh -File Scripts/run_lan_packaged_smoke.ps1 -Tag lan-task7
```

Expected: `BLA_LAN_PACKAGED_SMOKE_OK`. Host log has `BLA_LAN_PACKAGED_HOST_WAITING`, `BLA_LAN_PACKAGED_STARTED`, `BLA_LAN_PACKAGED_STATE`. Client log has `BLA_LAN_PACKAGED_CLIENT_JOINED`, `BLA_LAN_PACKAGED_TEAM`, `BLA_LAN_PACKAGED_STARTED`, `BLA_LAN_PACKAGED_STATE`. After killing the client, the host process is still alive and has not logged `BLA_LAN_PACKAGED_MENU`. After killing the host in the second pair, the client log has `FLOW_LAN_HOST_LEFT` and `BLA_LAN_PACKAGED_MENU`.

Write `docs/builds/lan-listen-server-smoke-2026-09-15.md` with the cook command, exe path, both process command lines, marker table, and pass/fail. Reuse the RunUAT line from `docs/builds/windows-mvp-smoke-test.md`.

File contents:

- Title: LAN Listen Server Packaged Smoke - 2026-09-15
- Engine: `D:\Epic Games\UE_5.8`
- Exe: `D:\dev\BLA-Packaged\Windows\BlackarmsLibertyAmerica.exe`
- Cook: `& "D:\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat" BuildCookRun -project="D:\dev\Blackarms-LibertyAmerica\BlackarmsLibertyAmerica.uproject" -noP4 -platform=Win64 -clientconfig=Development -cook -map=+/Game/BLA/Maps/Graybox/L_TestBootstrap+/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination+/Game/BLA/Maps/Final/L_BLA_ZeroFacility -build -stage -pak -archive -archivedirectory=D:\dev\BLA-Packaged -utf8output -nocompileeditor`
- Host args: `-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5 -nullrhi -nosound -unattended`
- Client args: `-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders -nullrhi -nosound -unattended`
- Marker table: `BLA_LAN_PACKAGED_HOST_WAITING` (host), `BLA_LAN_PACKAGED_CLIENT_JOINED` (client), `BLA_LAN_PACKAGED_TEAM` (client), `BLA_LAN_PACKAGED_STARTED` (both), `BLA_LAN_PACKAGED_STATE` (both; same RoundPhase and scores), host remains alive with no `BLA_LAN_PACKAGED_MENU` after client kill, `FLOW_LAN_HOST_LEFT` plus `BLA_LAN_PACKAGED_MENU` on client after host kill in pair 2, runner prints `BLA_LAN_PACKAGED_SMOKE_OK`.
- Fill the actual log tags and pass/fail after the run.

- [ ] **Step 6: Run the default offline 25-check matrix**

Restore play settings are already required in the PIE driver. Still run the full default matrix, which must not include LAN:

```powershell
Get-Process UnrealEditor-Cmd -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process BlackarmsLibertyAmerica -ErrorAction SilentlyContinue | Stop-Process -Force
pwsh -File Scripts/run_verification.ps1 -Tag lan-task7-offline
```

Expected: `MATRIX_DONE checks=25 failed=0` and `MATRIX_OK`. If this is 26 or 27, LAN was added to `$matrix`. Remove it from `$matrix`. Standalone `RequestStartMatch` must still travel without `?listen`.

- [ ] **Step 7: Update README and Chinese progress**

Replace the README `## LAN Extension Roadmap` deferred blurb with the actual Host/Join path. Use a four-backtick outer fence so the inner PowerShell fence does not close early.

````markdown
## LAN Listen Server

Windows PC LAN uses a listen server on port 7777 (`IpNetDriver`). The menu stays standalone.
Host travel is `MatchMapPath?listen`. Join is a direct IPv4 (`127.0.0.1` or `IP:7777`).
Waiting happens on the match map. Players pick Attack/Defense. The host starts the match and empty slots are filled with the existing `SpawnBot()` path.

Unattended flags (not shown on the Shipping menu):

- Host: `-BLALanHost -BLALanMode=Elimination -BLALanTeamSize=2 -BLALanAutoStart=5`
- Client: `-BLALanJoin=127.0.0.1 -BLALanTeam=Defenders`

LAN editor checks are extra `-Only` targets and are not part of the default 25-check offline matrix:

```powershell
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_contracts
pwsh -File Scripts/run_verification.ps1 -Only verify_lan_pie -TimeoutSeconds 420
pwsh -File Scripts/run_lan_packaged_smoke.ps1
```

No Steam, no matchmaking, no Dedicated Server. LAN uses the same Zero Facility `MatchMapPath` as offline `RequestStartMatch()`.
````

Write Chinese progress with the Codex primary-runtime Python `Path.write_text(..., encoding="utf-8", newline="\n")`. Do not put Chinese inside `python -c` or a PowerShell here-string. The file contents are:

```markdown
# LAN Listen Server 进度

计划：`docs/superpowers/plans/2026-09-15-lan-listen-server.md`

## Task 7

- PIE：`verify_lan_pie`，`BLA_LAN_PIE_DRIVER_OK sessions=3`。
- 打包：`Scripts/run_lan_packaged_smoke.ps1`，`BLA_LAN_PACKAGED_SMOKE_OK`。
- 离线回归：`MATRIX_DONE checks=25 failed=0`。
- 记录：`docs/builds/lan-listen-server-smoke-2026-09-15.md`。

把 Steps 4-6 的真实 log tag 与 marker 行填进本文件。保持中文。
```

Fill the progress file with the real log tags and marker lines from Steps 4-6 after they pass. Keep it in Chinese.


- [ ] **Step 8: Commit**

```powershell
git add Scripts/Editor/verify_lan_pie.py Scripts/run_lan_packaged_smoke.ps1 Scripts/run_verification.ps1 Source/BLA/Public/BLALanStatics.h Source/BLA/Private/BLALanStatics.cpp Source/BLA/Public/BLAGameModeElimination.h Source/BLA/Private/BLAGameModeElimination.cpp Source/BLA/Public/BLAPlayerController.h Source/BLA/Private/BLAPlayerController.cpp Source/BLA/Public/BLAGameInstance.h Source/BLA/Private/BLAGameInstance.cpp Source/BLA/Public/BLAPlayerState.h Source/BLA/BLA.Build.cs README.md docs/builds/lan-listen-server-smoke-2026-09-15.md docs/superpowers/sdd/2026-09-15-lan-listen-server/progress.md
git commit -m "test: verify LAN listen server PIE and packaged smoke"
```

Do not push. Do not add LAN to the default 25-check matrix.


