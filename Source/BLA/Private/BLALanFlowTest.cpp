#include "BLALanFlowTest.h"

#include "BLAGameInstance.h"
#include "BLAGameState.h"
#include "BLALanStatics.h"
#include "BLAAIController.h"
#include "BLACharacterBase.h"
#include "BLAHealthComponent.h"
#include "BLAGameModeElimination.h"
#include "BLAPlayerController.h"
#include "BLAPlayerState.h"
#include "Kismet/GameplayStatics.h"
#include "EngineUtils.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

ABLALanFlowTest::ABLALanFlowTest()
{
    PrimaryActorTick.bCanEverTick = false;
}


void ABLALanFlowTest::RunJoinAndTeamContracts()
{
    ABLAGameModeElimination* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr;
    ABLAPlayerController* Host = GetWorld() ? Cast<ABLAPlayerController>(GetWorld()->GetFirstPlayerController()) : nullptr;
    if (!GameMode || !Host)
    {
        bTestFailed = true;
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_JOIN_FAILED reason=missing_host"));
        return;
    }

    const bool bHostDefenders = GameMode->SetLANTeam(Host, EBLA_Team::Defenders);
    const bool bHostAttackers = GameMode->SetLANTeam(Host, EBLA_Team::Attackers);
    const bool bOpenBeforeJoin = GameMode->CanAcceptLANJoin();
    APlayerController* ExtraBase = UGameplayStatics::CreatePlayer(GetWorld(), 1, true);
    ABLAPlayerController* Extra = Cast<ABLAPlayerController>(ExtraBase);
    ABLAPlayerState* ExtraState = Extra ? Extra->GetPlayerState<ABLAPlayerState>() : nullptr;
    const bool bJoinNeutral = ExtraState && ExtraState->Team == EBLA_Team::Neutral;
    const bool bPicked = Extra && GameMode->SetLANTeam(Extra, EBLA_Team::Defenders);
    const bool bTeamFull = !GameMode->SetLANTeam(Host, EBLA_Team::Defenders);
    const ABLAGameState* State = GetWorld()->GetGameState<ABLAGameState>();
    const bool bRoster = State && State->LANRoster.Num() == 2;

    if (bHostDefenders && bHostAttackers && bOpenBeforeJoin && Extra && bJoinNeutral && bPicked && bTeamFull && bRoster)
    {
        bTestSucceeded = true;
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_JOIN_OK accepted=1 team_pick=1 team_full=1 started_reject=0"));
        return;
    }

    bTestFailed = true;
    UE_LOG(LogTemp, Error, TEXT("BLA_LAN_JOIN_FAILED host_def=%d host_atk=%d open=%d extra=%d neutral=%d picked=%d full=%d roster=%d"),
        bHostDefenders, bHostAttackers, bOpenBeforeJoin, Extra != nullptr, bJoinNeutral, bPicked, bTeamFull, bRoster);
}


void ABLALanFlowTest::RunStartContracts()
{
    ABLAGameModeElimination* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr;
    ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
    ABLAPlayerController* Host = GetWorld() ? Cast<ABLAPlayerController>(GetWorld()->GetFirstPlayerController()) : nullptr;
    UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    if (!GameMode || !State || !Host || !GameInstance)
    {
        bTestFailed = true;
        UE_LOG(LogTemp, Error, TEXT("BLA_LAN_START_FAILED reason=missing_world"));
        return;
    }

    GameInstance->ApplyTeamSize(2);
    State->AttackersTeamSize = 2;
    State->DefendersTeamSize = 2;
    ABLAPlayerState* HostState = Host->GetPlayerState<ABLAPlayerState>();
    ABLAPlayerController* Extra = Cast<ABLAPlayerController>(UGameplayStatics::CreatePlayer(GetWorld(), 1, true));
    ABLAPlayerState* ExtraState = Extra ? Extra->GetPlayerState<ABLAPlayerState>() : nullptr;
    if (HostState)
    {
        HostState->Team = EBLA_Team::Neutral;
    }
    if (ExtraState)
    {
        ExtraState->Team = EBLA_Team::Neutral;
    }
    if (Extra)
    {
        Extra->ServerStartLANMatch();
    }
    const bool bStillWaitingAfterClientStart = State->RoundPhase == EBLA_RoundPhase::Waiting;
    const bool bNotHostReported = GameInstance->LastFlowError.Contains(TEXT("FLOW_LAN_NOT_HOST"));

    const bool bHostStarted = GameMode->StartLANMatch(Host);
    int32 BotCount = 0;
    int32 CombatantCount = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotCount; }
    for (TActorIterator<ABLACharacterBase> It(GetWorld()); It; ++It) { ++CombatantCount; }

    const bool bRejectAfterStart = !GameMode->CanAcceptLANJoin();
    APlayerController* Late = UGameplayStatics::CreatePlayer(GetWorld(), 2, true);
    const bool bLateRejected = Late == nullptr || !GameMode->CanAcceptLANJoin();
    if (Late)
    {
        UGameplayStatics::RemovePlayer(Late, true);
    }

    const bool bPhasePreparation = State->RoundPhase == EBLA_RoundPhase::Preparation;
    const bool bNeutralAssigned = HostState && ExtraState
        && HostState->Team == EBLA_Team::Attackers && ExtraState->Team == EBLA_Team::Defenders;
    if (bHostStarted && bStillWaitingAfterClientStart && bNotHostReported && bPhasePreparation
        && BotCount == 2 && CombatantCount == 4 && bRejectAfterStart && bLateRejected && bNeutralAssigned)
    {
        bTestSucceeded = true;
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_NEUTRAL_OK host=0 extra=1"));
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_START_OK not_host=1 bots=%d total=%d started_reject=1"), BotCount, CombatantCount);
        return;
    }

    bTestFailed = true;
    UE_LOG(LogTemp, Error, TEXT("BLA_LAN_START_FAILED not_host=%d started=%d phase=%d bots=%d total=%d reject=%d"),
        bStillWaitingAfterClientStart && bNotHostReported, bHostStarted,
        static_cast<int32>(State->RoundPhase), BotCount, CombatantCount, bRejectAfterStart);
}


void ABLALanFlowTest::RunAuthorityAndDisconnectContracts()
{
    ABLAGameModeElimination* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr;
    ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
    if (!GameMode || !State || State->RoundPhase == EBLA_RoundPhase::Waiting)
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
    const int32 HumansBefore = GameMode->CountHumans();
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
    const int32 HumansAfterLeave = GameMode->CountHumans();
    int32 BotsAfterLeave = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotsAfterLeave; }

    GameMode->FillVacantLANSlotsWithBots();
    int32 BotsAfterFill = 0;
    for (TActorIterator<ABLABotCharacter> It(GetWorld()); It; ++It) { ++BotsAfterFill; }
    if (bServerDamage && HealthAfterServer < 100.0f && HumansAfterLeave == HumansBefore - 1
        && BotsAfterLeave == BotsBefore && BotsAfterFill == BotsBefore + 1)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_AUTHORITY_OK damage_server=1 leave_empty_slot=1 next_round_fill=1"));
        return;
    }
    UE_LOG(LogTemp, Error, TEXT("BLA_LAN_AUTHORITY_FAILED dmg=%d health=%.1f humans=%d/%d bots=%d/%d/%d"),
        bServerDamage, HealthAfterServer, HumansBefore, HumansAfterLeave, BotsBefore, BotsAfterLeave, BotsAfterFill);
}

void ABLALanFlowTest::RunWaitingContracts()
{
    const ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
    const ENetMode NetMode = GetWorld() ? GetWorld()->GetNetMode() : NM_MAX;
    int32 BotCount = 0;
    if (GetWorld())
    {
        for (TActorIterator<ABLAAIController> It(GetWorld()); It; ++It)
        {
            ++BotCount;
        }
    }
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

void ABLALanFlowTest::BeginPlay()
{
    Super::BeginPlay();
    if (FParse::Param(FCommandLine::Get(), TEXT("BLALanContracts")))
    {
        RunAddressContracts();
    }
}

void ABLALanFlowTest::RunAddressContracts()
{
    struct FCase
    {
        const TCHAR* Input;
        bool bExpectValid;
        int32 Port;
        const TCHAR* Error;
    };
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

    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    const FString ListenURL = GameInstance
        ? UBLALanStatics::BuildListenMapURL(GameInstance->MatchMapPath, 7777)
        : FString();
    const bool bListenHasFlag = ListenURL.EndsWith(TEXT("?listen"));
    const bool bOfflineClean = GameInstance && !GameInstance->MatchMapPath.Contains(TEXT("?listen"));
    bool bTravelRequestsClean = false;
    if (GameInstance)
    {
        const bool bPreviousTravelImmediately = GameInstance->bTravelImmediately;
        const bool bPreviousTravelInProgress = GameInstance->bTravelInProgress;
        const FString PreviousTravelRequest = GameInstance->LastTravelRequest;
        const FString PreviousFlowError = GameInstance->LastFlowError;

        GameInstance->bTravelImmediately = false;
        GameInstance->bTravelInProgress = false;
        const bool bOfflineRequested = GameInstance->RequestStartMatch();
        const bool bOfflineRequestClean = bOfflineRequested
            && GameInstance->LastTravelRequest == GameInstance->MatchMapPath
            && !GameInstance->LastTravelRequest.Contains(TEXT("?listen"));

        GameInstance->bTravelInProgress = false;
        const bool bHostRequested = GameInstance->RequestHostLANMatch();
        const bool bHostRequestClean = bHostRequested
            && GameInstance->LastTravelRequest == ListenURL;
        bTravelRequestsClean = bOfflineRequestClean && bHostRequestClean;

        GameInstance->bTravelImmediately = bPreviousTravelImmediately;
        GameInstance->bTravelInProgress = bPreviousTravelInProgress;
        GameInstance->LastTravelRequest = PreviousTravelRequest;
        GameInstance->LastFlowError = PreviousFlowError;
    }

    if (Failed == 0 && bListenHasFlag && bOfflineClean && bTravelRequestsClean)
    {
        bTestSucceeded = true;
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_CONTRACTS_OK cases=%d listen=1 offline_clean=1"),
            UE_ARRAY_COUNT(Cases));
    }
    else
    {
        bTestFailed = true;
        UE_LOG(LogTemp, Error,
            TEXT("BLA_LAN_CONTRACTS_FAILED failed=%d listen=%d offline_clean=%d travel_requests=%d"),
            Failed, bListenHasFlag ? 1 : 0, bOfflineClean ? 1 : 0, bTravelRequestsClean ? 1 : 0);
    }
}
