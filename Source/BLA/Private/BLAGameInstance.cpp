#include "BLAGameInstance.h"

#include "BLADebugSubsystem.h"
#include "BLALanStatics.h"
#include "BLAPlayerController.h"
#include "BLAPlayerState.h"
#include "BLAUIManager.h"
#include "BLASettingsSaveGame.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "Engine/NetDriver.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/PackageName.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

namespace
{
    const TCHAR* GameInstanceDifficultyPaths[] =
    {
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Easy.DA_BLABotDifficulty_Easy"),
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Normal.DA_BLABotDifficulty_Normal"),
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Hard.DA_BLABotDifficulty_Hard")
    };

    const TCHAR* GameInstanceRulesPaths[] =
    {
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_Solo.DA_BLAMatchRules_Solo"),
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_2v2.DA_BLAMatchRules_2v2"),
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_3v3.DA_BLAMatchRules_3v3")
    };
}

void UBLAGameInstance::Init()
{
    Super::Init();
    if (GEngine)
    {
        GEngine->OnNetworkFailure().AddUObject(this, &UBLAGameInstance::HandleNetworkFailure);
    }
#if !UE_BUILD_SHIPPING
    const TCHAR* CommandLine = FCommandLine::Get();
    bLanHostRequested = FParse::Param(CommandLine, TEXT("BLALanHost"));
    FParse::Value(CommandLine, TEXT("BLALanJoin="), LanJoinAddress);
    FParse::Value(CommandLine, TEXT("BLALanTeam="), LanTeamName);
    FParse::Value(CommandLine, TEXT("BLALanMode="), LanModeName);
    FParse::Value(CommandLine, TEXT("BLALanTeamSize="), LanTeamSizeOverride);
    UBLALanStatics::ParseLANAutoStartSeconds(CommandLine, LanAutoStartSeconds);
    if (bLanHostRequested || !LanJoinAddress.IsEmpty())
    {
        MatchMapPath = TEXT("/Game/BLA/Maps/Final/L_BLA_ZeroFacility");
    }
#endif
}

void UBLAGameInstance::Shutdown()
{
    if (GEngine)
    {
        GEngine->OnNetworkFailure().RemoveAll(this);
    }
    Super::Shutdown();
}

void UBLAGameInstance::ApplyModeSelection(EBLA_MatchMode Mode)
{
    SelectedMode = Mode;
}

bool UBLAGameInstance::ApplyTeamSize(int32 TeamSize)
{
    if (TeamSize < 1 || TeamSize > 3)
    {
        ReportFlowFailure(TEXT("FLOW_INVALID_TEAM_SIZE"), FString::Printf(TEXT("team_size=%d"), TeamSize));
        return false;
    }
    SelectedTeamSize = TeamSize;
    SelectedRules = LoadObject<UBLAMatchRulesDataAsset>(nullptr, GameInstanceRulesPaths[SelectedTeamSize - 1]);
    LastFlowError.Empty();
    return true;
}

void UBLAGameInstance::ApplyDifficultyLevel(EBLA_DifficultyLevel Level)
{
    SelectedDifficultyLevel = Level;
    SelectedDifficulty = LoadObject<UBLABotDifficultyDataAsset>(
        nullptr, GameInstanceDifficultyPaths[static_cast<int32>(Level)]);
}

void UBLAGameInstance::SaveSettings()
{
    if (!Settings)
    {
        Settings = NewObject<UBLASettingsSaveGame>(this);
    }
    UGameplayStatics::SaveGameToSlot(Settings, SettingsSlotName, 0);
}

void UBLAGameInstance::LoadSettings()
{
    if (UGameplayStatics::DoesSaveGameExist(SettingsSlotName, 0))
    {
        Settings = Cast<UBLASettingsSaveGame>(UGameplayStatics::LoadGameFromSlot(SettingsSlotName, 0));
    }
    if (!Settings)
    {
        Settings = NewObject<UBLASettingsSaveGame>(this);
    }
}

void UBLAGameInstance::ResetSettings()
{
    Settings = NewObject<UBLASettingsSaveGame>(this);
    UGameplayStatics::SaveGameToSlot(Settings, SettingsSlotName, 0);
}

void UBLAGameInstance::ReportFlowFailure(const FString& Code, const FString& Details)
{
    LastFlowError = Details.IsEmpty() ? Code : FString::Printf(TEXT("%s %s"), *Code, *Details);
    if (UBLADebugSubsystem* Debug = GetSubsystem<UBLADebugSubsystem>())
    {
        Debug->ReportEvent(FName(*Code), LastFlowError);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("BLA_FLOW_FAILED %s"), *LastFlowError);
    }
}

bool UBLAGameInstance::IsCurrentMap(const FString& MapPath) const
{
    const UWorld* World = GetWorld();
    if (!World || MapPath.IsEmpty())
    {
        return false;
    }
    const FString ShortName = FPackageName::GetShortName(MapPath);
    return !ShortName.IsEmpty() && World->GetMapName().Contains(ShortName);
}

void UBLAGameInstance::OnWorldChanged(UWorld* OldWorld, UWorld* NewWorld)
{
    Super::OnWorldChanged(OldWorld, NewWorld);
    if (!NewWorld)
    {
        return;
    }

    bTravelInProgress = false;
    LanWorldTicks = 0;
    NewWorld->GetTimerManager().ClearTimer(LanCommandLineTimer);
    NewWorld->GetTimerManager().SetTimer(LanCommandLineTimer, this,
        &UBLAGameInstance::TickCommandLineLAN, 0.1f, true, 0.1f);

#if !UE_BUILD_SHIPPING
    if (bLanLeaveRequested && IsCurrentMap(MenuMapPath))
    {
        bLanLeaveRequested = false;
        if (!bPackagedMenuLogged)
        {
            bPackagedMenuLogged = true;
            UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_MENU"));
        }
    }
#endif
}

void UBLAGameInstance::TickCommandLineLAN()
{
#if !UE_BUILD_SHIPPING
    UWorld* World = GetWorld();
    if (!World)
    {
        return;
    }
    ++LanWorldTicks;

    if (World->GetNetMode() == NM_Client)
    {
        EnsureClientUIManager();
    }

    if (!bLanLaunchHandled && IsCurrentMap(MenuMapPath) && (bLanHostRequested || !LanJoinAddress.IsEmpty()))
    {
        if (!bLanHostRequested && !GetFirstLocalPlayerController())
        {
            return;
        }
        bLanLaunchHandled = true;
        ApplyModeSelection(LanModeName.Equals(TEXT("DataCore"), ESearchCase::IgnoreCase)
            ? EBLA_MatchMode::DataCoreAttackDefense : EBLA_MatchMode::TeamElimination);
        if (LanTeamSizeOverride > 0)
        {
            ApplyTeamSize(FMath::Clamp(LanTeamSizeOverride, 1, 3));
        }
        if (bLanHostRequested)
        {
            RequestHostLANMatch();
        }
        else
        {
            RequestJoinLANMatch(LanJoinAddress);
        }
        return;
    }

    if (bLanHostRequested && bLanLaunchHandled && IsCurrentMap(MatchMapPath)
        && LanWorldTicks >= 3 && World->GetNetMode() != NM_ListenServer)
    {
        ReportFlowFailure(TEXT("FLOW_LAN_LISTEN_FAILED"));
        bLanHostRequested = false;
        RequestLeaveLAN();
        return;
    }

    if (!bLanTeamApplied && World->GetNetMode() == NM_Client && !LanTeamName.IsEmpty())
    {
        ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(GetFirstLocalPlayerController());
        ABLAPlayerState* PlayerState = PlayerController ? PlayerController->GetPlayerState<ABLAPlayerState>() : nullptr;
        if (PlayerController && PlayerState)
        {
            const EBLA_Team RequestedTeam = LanTeamName.Equals(TEXT("Defenders"), ESearchCase::IgnoreCase)
                ? EBLA_Team::Defenders : EBLA_Team::Attackers;
            bLanTeamApplied = true;
            PlayerController->ServerSetTeam(RequestedTeam);
        }
    }
#endif
    return;
}

void UBLAGameInstance::EnsureClientUIManager()
{
    UWorld* World = GetWorld();
    if (!World || UGameplayStatics::GetActorOfClass(World, ABLAUIManager::StaticClass()))
    {
        return;
    }
    UClass* ManagerClass = LoadClass<ABLAUIManager>(
        nullptr, TEXT("/Game/BLA/Blueprints/UI/BP_BLAUIManager.BP_BLAUIManager_C"));
    if (!ManagerClass)
    {
        ManagerClass = ABLAUIManager::StaticClass();
    }
    ABLAUIManager* Manager = World->SpawnActorDeferred<ABLAUIManager>(
        ManagerClass, FTransform::Identity, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
    if (Manager)
    {
        Manager->bStartInMainMenu = false;
        Manager->FinishSpawning(FTransform::Identity);
    }
}

void UBLAGameInstance::HandleNetworkFailure(UWorld* World, UNetDriver* NetDriver,
    ENetworkFailure::Type FailureType, const FString& ErrorString)
{
    const bool bWasConnectedClient = World && World->GetNetMode() == NM_Client
        && World->GetGameState() != nullptr;
    if (UBLALanStatics::ShouldTreatLANNetworkFailureAsHostLeft(
            bWasConnectedClient, static_cast<int32>(FailureType)))
    {
        ReportFlowFailure(TEXT("FLOW_LAN_HOST_LEFT"), ErrorString);
    }
    else
    {
        ReportFlowFailure(TEXT("FLOW_LAN_CONNECT_FAILED"), ErrorString);
    }
    RequestLeaveLAN();
}

bool UBLAGameInstance::TravelTo(const FString& MapPath)
{
    if (MapPath.IsEmpty())
    {
        ReportFlowFailure(TEXT("FLOW_EMPTY_MAP"), TEXT("path is empty"));
        return false;
    }
    if (bTravelInProgress || IsCurrentMap(MapPath))
    {
        ReportFlowFailure(TEXT("FLOW_DUPLICATE_TRAVEL"), MapPath);
        return false;
    }
    LastTravelRequest = MapPath;
    LastFlowError.Empty();
    bTravelInProgress = true;
    if (bTravelImmediately)
    {
        UGameplayStatics::OpenLevel(this, FName(*MapPath));
    }
    return true;
}

bool UBLAGameInstance::RequestStartMatch()
{
    return TravelTo(MatchMapPath);
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
    if (APlayerController* PlayerController = GetFirstLocalPlayerController())
    {
        PlayerController->ClientTravel(URL, TRAVEL_Absolute);
        return true;
    }

    ReportFlowFailure(TEXT("FLOW_LAN_CONNECT_FAILED"), TEXT("no local player"));
    bTravelInProgress = false;
    return false;
}

bool UBLAGameInstance::RequestLeaveLAN()
{
    bLanLeaveRequested = true;
    bTravelInProgress = false;
    if (UWorld* World = GetWorld())
    {
        if (World->GetNetDriver() && GEngine)
        {
            GEngine->ShutdownWorldNetDriver(World);
        }
    }
    return TravelTo(MenuMapPath);
}

bool UBLAGameInstance::RequestReturnToMenu()
{
    return TravelTo(MenuMapPath);
}
