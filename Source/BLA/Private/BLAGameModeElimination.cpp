#include "BLAGameModeElimination.h"
#include "BLAAIController.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BLACharacterBase.h"
#include "BLAGameInstance.h"
#include "BLAGameState.h"
#include "BLALanStatics.h"
#include "BLAMapConfig.h"
#include "BLAObjectiveManager.h"
#include "BLAPlayerController.h"
#include "BLAPlayerState.h"
#include "BLARoleAssignment.h"
#include "BLARoundManager.h"
#include "BLASpawnPoint.h"
#include "BLATacticalManager.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "BLAUIManager.h"
#include "BLAWeaponBase.h"
#include "BLAWeaponComponent.h"
#include "BLAWeaponTypes.h"
#include "EngineUtils.h"
#include "GameFramework/GameSession.h"
#include "Kismet/GameplayStatics.h"
#include "TimerManager.h"
#include "HAL/PlatformTime.h"

ABLAGameModeElimination::ABLAGameModeElimination()
{
    GameStateClass = ABLAGameState::StaticClass();
}

void ABLAGameModeElimination::BeginPlay()
{
    Super::BeginPlay();
    TeamManager = GetWorld()->SpawnActor<ABLATeamManager>();
    RoundManager = GetWorld()->SpawnActor<ABLARoundManager>();
    TeamOrderManager = GetWorld()->SpawnActor<ABLATeamOrderManager>();
    RoleAssignment = GetWorld()->SpawnActor<ABLARoleAssignment>();
    TacticalManager = GetWorld()->SpawnActor<ABLATacticalManager>();
    if (IsLANListenMatch())
    {
        GetWorldTimerManager().SetTimer(
            InitializeMatchTimer,
            this,
            &ABLAGameModeElimination::EnterLANWaiting,
            0.05f,
            false);
        return;
    }
    GetWorldTimerManager().SetTimer(InitializeMatchTimer, this, &ABLAGameModeElimination::InitializeMatch, 0.25f, false);
}

bool ABLAGameModeElimination::IsLANListenMatch() const
{
    return GetWorld() && GetWorld()->GetNetMode() == NM_ListenServer;
}

void ABLAGameModeElimination::EnterLANWaiting()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    if (State && GameInstance)
    {
        State->MatchMode = GameInstance->SelectedMode;
        State->AttackersTeamSize = GameInstance->SelectedTeamSize;
        State->DefendersTeamSize = GameInstance->SelectedTeamSize;
        State->DifficultyLevel = GameInstance->SelectedDifficultyLevel;
        State->RoundPhase = EBLA_RoundPhase::Waiting;
    }
    if (APlayerController* PlayerController = GetWorld()->GetFirstPlayerController())
    {
        if (ABLAPlayerState* PlayerState = PlayerController->GetPlayerState<ABLAPlayerState>())
        {
            PlayerState->Team = EBLA_Team::Attackers;
            PlayerState->bIsLANHost = true;
        }
        APawn* WaitingPawn = PlayerController->GetPawn();
        PlayerController->UnPossess();
        if (Cast<ABLACharacterBase>(WaitingPawn))
        {
            WaitingPawn->Destroy();
        }
    }
    RefreshLANRoster();
    if (UIManager)
    {
        UIManager->Configure(this, RoundManager, TeamOrderManager);
        UIManager->ShowScreen(EBLA_UIScreen::LANWaiting);
    }
#if !UE_BUILD_SHIPPING
    UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_HOST_WAITING ip=%s port=7777"),
        *UBLALanStatics::GetAdvertiseIPv4());
    if (GameInstance && GameInstance->LanAutoStartSeconds > 0.0f)
    {
        LANAutoStartRequestedSeconds = GameInstance->LanAutoStartSeconds;
        LANAutoStartEpoch = FPlatformTime::Seconds();
        GetWorldTimerManager().SetTimer(
            LANAutoStartTimer,
            this,
            &ABLAGameModeElimination::HandleLANAutoStart,
            0.05f,
            true);
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_AUTOSTART_ARMED seconds=%f"), LANAutoStartRequestedSeconds);
    }
#endif
    UE_LOG(LogTemp, Display, TEXT("BLA_LAN_WAITING_ENTERED team_size=%d gi=%s class=%s"),
        GameInstance ? GameInstance->SelectedTeamSize : 0,
        GameInstance ? *GameInstance->GetName() : TEXT("None"),
        GameInstance ? *GameInstance->GetClass()->GetPathName() : TEXT("None"));
}

void ABLAGameModeElimination::HandleLANAutoStart()
{
    const double Elapsed = FPlatformTime::Seconds() - LANAutoStartEpoch;
    if (!UBLALanStatics::ShouldFireLANAutoStart(LANAutoStartRequestedSeconds, Elapsed))
    {
        return;
    }
    GetWorldTimerManager().ClearTimer(LANAutoStartTimer);
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (IsLANListenMatch() && State && State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_AUTOSTART_FIRE elapsed_real=%f humans=%d"),
            Elapsed, CountHumans());
        StartLANMatch(GetWorld()->GetFirstPlayerController());
    }
}

void ABLAGameModeElimination::RefreshLANRoster()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!State)
    {
        return;
    }
    State->LANRoster.Reset();
    for (APlayerState* BasePlayerState : State->PlayerArray)
    {
        ABLAPlayerState* PlayerState = Cast<ABLAPlayerState>(BasePlayerState);
        if (!PlayerState || PlayerState->IsABot())
        {
            continue;
        }
        FBLALanRosterEntry Entry;
        Entry.DisplayName = PlayerState->GetPlayerName();
        Entry.Team = PlayerState->Team;
        Entry.bIsLANHost = PlayerState->bIsLANHost;
        State->LANRoster.Add(Entry);
    }
}

APawn* ABLAGameModeElimination::SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot)
{
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    if (State && State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        return nullptr;
    }
    return Super::SpawnDefaultPawnFor_Implementation(NewPlayer, StartSpot);
}

APawn* ABLAGameModeElimination::SpawnDefaultPawnAtTransform_Implementation(
    AController* NewPlayer, const FTransform& SpawnTransform)
{
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    if (State && State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        return nullptr;
    }
    return Super::SpawnDefaultPawnAtTransform_Implementation(NewPlayer, SpawnTransform);
}


bool ABLAGameModeElimination::CanAcceptLANJoin() const
{
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    return State && State->RoundPhase == EBLA_RoundPhase::Waiting
        && CountHumans() < State->AttackersTeamSize * 2;
}

int32 ABLAGameModeElimination::CountHumans() const
{
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    int32 Count = 0;
    if (State)
    {
        for (APlayerState* BaseState : State->PlayerArray)
        {
            if (const ABLAPlayerState* PlayerState = Cast<ABLAPlayerState>(BaseState); PlayerState && !PlayerState->IsABot())
            {
                ++Count;
            }
        }
    }
    return Count;
}

int32 ABLAGameModeElimination::CountHumansOnTeam(EBLA_Team Team) const
{
    const ABLAGameState* State = GetGameState<ABLAGameState>();
    int32 Count = 0;
    if (State)
    {
        for (APlayerState* BaseState : State->PlayerArray)
        {
            if (const ABLAPlayerState* PlayerState = Cast<ABLAPlayerState>(BaseState);
                PlayerState && !PlayerState->IsABot() && PlayerState->Team == Team)
            {
                ++Count;
            }
        }
    }
    return Count;
}

void ABLAGameModeElimination::PostLogin(APlayerController* NewPlayer)
{
    Super::PostLogin(NewPlayer);
    if (!IsLANListenMatch())
    {
        return;
    }

    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (State && State->RoundPhase == EBLA_RoundPhase::Loading)
    {
        return;
    }

    FString RejectCode;
    if (!State || State->RoundPhase != EBLA_RoundPhase::Waiting)
    {
        RejectCode = TEXT("FLOW_LAN_JOIN_REJECTED_STARTED");
    }
    else if (CountHumans() > State->AttackersTeamSize * 2)
    {
        RejectCode = TEXT("FLOW_LAN_JOIN_REJECTED_FULL");
    }
    if (!RejectCode.IsEmpty())
    {
        if (ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(NewPlayer))
        {
            PlayerController->ClientNotifyFlowError(RejectCode);
        }
        // AGameSession::KickPlayer only closes UNetConnection clients. A PIE extra
        // created with CreatePlayer is a local player, so remove that local player
        // instead of leaving the listen session.
        if (NewPlayer && NewPlayer->IsLocalPlayerController())
        {
            TWeakObjectPtr<APlayerController> WeakPlayer(NewPlayer);
            GetWorldTimerManager().SetTimerForNextTick([WeakPlayer]()
            {
                if (APlayerController* Player = WeakPlayer.Get())
                {
                    UGameplayStatics::RemovePlayer(Player, true);
                }
            });
        }
        else if (GameSession)
        {
            GameSession->KickPlayer(NewPlayer, FText::FromString(RejectCode));
        }
        return;
    }

    if (ABLAPlayerState* PlayerState = NewPlayer->GetPlayerState<ABLAPlayerState>(); PlayerState && !PlayerState->bIsLANHost)
    {
        PlayerState->Team = EBLA_Team::Neutral;
    }
    NewPlayer->UnPossess();
    RefreshLANRoster();
}

void ABLAGameModeElimination::Logout(AController* Exiting)
{
    const ABLAPlayerState* LeavingState = Exiting ? Exiting->GetPlayerState<ABLAPlayerState>() : nullptr;
    const bool bHostLeft = LeavingState && LeavingState->bIsLANHost;
    if (TeamManager && Exiting)
    {
        if (ABLACharacterBase* LeavingCombatant = Cast<ABLACharacterBase>(Exiting->GetPawn()))
        {
            TeamManager->UnregisterCombatant(LeavingCombatant);
        }
    }

    Super::Logout(Exiting);
    if (!IsLANListenMatch())
    {
        return;
    }
    if (bHostLeft)
    {
        for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
        {
            if (ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(It->Get()))
            {
                PlayerController->ClientNotifyFlowError(TEXT("FLOW_LAN_HOST_LEFT"));
            }
        }
        if (UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>())
        {
            GameInstance->RequestLeaveLAN();
        }
        return;
    }

    RefreshLANRoster();
    if (ABLAGameState* State = GetGameState<ABLAGameState>())
    {
        State->LivingAttackers = TeamManager ? TeamManager->GetLivingCount(EBLA_Team::Attackers) : 0;
        State->LivingDefenders = TeamManager ? TeamManager->GetLivingCount(EBLA_Team::Defenders) : 0;
    }
}

bool ABLAGameModeElimination::SetLANTeam(APlayerController* PlayerController, EBLA_Team Team)
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    ABLAPlayerState* PlayerState = PlayerController ? PlayerController->GetPlayerState<ABLAPlayerState>() : nullptr;
    if (!State || !PlayerState || State->RoundPhase != EBLA_RoundPhase::Waiting
        || (Team != EBLA_Team::Attackers && Team != EBLA_Team::Defenders))
    {
        return false;
    }
    if (PlayerState->Team != Team && CountHumansOnTeam(Team) >= State->AttackersTeamSize)
    {
        if (UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>())
        {
            GameInstance->ReportFlowFailure(TEXT("FLOW_LAN_TEAM_FULL"));
        }
        if (ABLAPlayerController* BLAController = Cast<ABLAPlayerController>(PlayerController))
        {
            BLAController->ClientNotifyFlowError(TEXT("FLOW_LAN_TEAM_FULL"));
        }
        return false;
    }
    PlayerState->Team = Team;
    RefreshLANRoster();
#if !UE_BUILD_SHIPPING
    UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_TEAM team=%s"),
        *StaticEnum<EBLA_Team>()->GetNameStringByValue(static_cast<int64>(PlayerState->Team)));
#endif
    return true;
}


bool ABLAGameModeElimination::StartLANMatch(APlayerController* Requestor)
{
    GetWorldTimerManager().ClearTimer(LANAutoStartTimer);
    ABLAGameState* State = GetGameState<ABLAGameState>();
    UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    ABLAPlayerState* RequestorState = Requestor ? Requestor->GetPlayerState<ABLAPlayerState>() : nullptr;
    if (!IsLANListenMatch() || !State || State->RoundPhase != EBLA_RoundPhase::Waiting)
    {
        return false;
    }
    if (!RequestorState || !RequestorState->bIsLANHost)
    {
        if (GameInstance)
        {
            GameInstance->ReportFlowFailure(TEXT("FLOW_LAN_NOT_HOST"));
        }
        if (ABLAPlayerController* BLAController = Cast<ABLAPlayerController>(Requestor))
        {
            BLAController->ClientNotifyFlowError(TEXT("FLOW_LAN_NOT_HOST"));
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
    if (AttackerBots.Num() != TeamSize - CountHumansOnTeam(EBLA_Team::Attackers)
        || DefenderBots.Num() != TeamSize - CountHumansOnTeam(EBLA_Team::Defenders))
    {
        return false;
    }

    ABLAPlayerCharacter* OrderAnchor = nullptr;
    for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
    {
        if (ABLAPlayerCharacter* Pawn = It->Get() ? Cast<ABLAPlayerCharacter>(It->Get()->GetPawn()) : nullptr)
        {
            OrderAnchor = Pawn;
            break;
        }
    }
    LaunchPreparedMatch(TeamSize, State->MatchMode, FindMapConfig(), AttackerBots, DefenderBots, OrderAnchor);
    RefreshLANRoster();
    if (State->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        State->RoundPhase = EBLA_RoundPhase::Preparation;
    }
    State->LivingAttackers = TeamManager ? TeamManager->GetLivingCount(EBLA_Team::Attackers) : TeamSize;
    State->LivingDefenders = TeamManager ? TeamManager->GetLivingCount(EBLA_Team::Defenders) : TeamSize;
#if !UE_BUILD_SHIPPING
    int32 BotCount = 0;
    for (TActorIterator<ABLAAIController> It(GetWorld()); It; ++It)
    {
        ++BotCount;
    }
    const int32 HumanCount = CountHumans();
    UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_STARTED phase=%d humans=%d bots=%d total=%d"),
        static_cast<int32>(State->RoundPhase), HumanCount, BotCount, HumanCount + BotCount);
#endif
    return State->RoundPhase == EBLA_RoundPhase::Preparation;
}

void ABLAGameModeElimination::AssignNeutralHumansForLAN()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!State)
    {
        return;
    }
    const int32 TeamSize = State->AttackersTeamSize;
    for (APlayerState* BaseState : State->PlayerArray)
    {
        ABLAPlayerState* PlayerState = Cast<ABLAPlayerState>(BaseState);
        if (!PlayerState || PlayerState->IsABot() || PlayerState->Team != EBLA_Team::Neutral)
        {
            continue;
        }
        const int32 AttackerHumans = CountHumansOnTeam(EBLA_Team::Attackers);
        const int32 DefenderHumans = CountHumansOnTeam(EBLA_Team::Defenders);
        EBLA_Team Preferred = AttackerHumans <= DefenderHumans ? EBLA_Team::Attackers : EBLA_Team::Defenders;
        if (CountHumansOnTeam(Preferred) >= TeamSize)
        {
            Preferred = Preferred == EBLA_Team::Attackers ? EBLA_Team::Defenders : EBLA_Team::Attackers;
        }
        PlayerState->Team = Preferred;
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
        APlayerController* PlayerController = It->Get();
        ABLAPlayerState* PlayerState = PlayerController ? PlayerController->GetPlayerState<ABLAPlayerState>() : nullptr;
        if (!PlayerController || !PlayerState || PlayerState->IsABot())
        {
            continue;
        }
        const EBLA_Team Team = PlayerState->Team;
        if (Team != EBLA_Team::Attackers && Team != EBLA_Team::Defenders)
        {
            return false;
        }
        const FName Zone = Team == EBLA_Team::Defenders ? TEXT("DefenseSpawn") : TEXT("AttackSpawn");
        ABLASpawnPoint* Spawn = TeamManager->SelectSpawnPoint(Team, Zone);
        const FTransform Transform = Spawn ? Spawn->GetActorTransform()
            : FTransform(FVector(0.0f, HumanIndex * 250.0f, 120.0f));
        FActorSpawnParameters Parameters;
        Parameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
        ABLAPlayerCharacter* Pawn = GetWorld()->SpawnActor<ABLAPlayerCharacter>(ABLAPlayerCharacter::StaticClass(), Transform, Parameters);
        if (!Pawn)
        {
            return false;
        }
        Pawn->Team = Team;
        PlayerController->Possess(Pawn);
        if (!TeamManager->RegisterCombatant(Pawn) || !EquipLoadout(Pawn))
        {
            Pawn->Destroy();
            return false;
        }
        if (ABLAPlayerController* BLAController = Cast<ABLAPlayerController>(PlayerController))
        {
            BLAController->ConfigureTeamSystems(TeamManager, TeamOrderManager);
        }
        ++HumanIndex;
    }
    return HumanIndex > 0;
}

void ABLAGameModeElimination::FillVacantLANSlotsWithBots()
{
    if (!IsLANListenMatch() || !TeamManager)
    {
        return;
    }

    const ABLAGameState* State = GetGameState<ABLAGameState>();
    const int32 TeamSize = State ? State->AttackersTeamSize : 1;
    TArray<ABLAAIController*> AttackerBots;
    TArray<ABLAAIController*> DefenderBots;
    FillLANBots(TeamSize, AttackerBots, DefenderBots);
    if (RoleAssignment)
    {
        RoleAssignment->AssignRoles(AttackerBots);
        RoleAssignment->AssignRoles(DefenderBots);
    }
}

void ABLAGameModeElimination::FillLANBots(int32 TeamSize, TArray<ABLAAIController*>& OutAttackerBots,
    TArray<ABLAAIController*>& OutDefenderBots)
{
    const int32 AttackerMembers = TeamManager ? TeamManager->GetTeamMembers(EBLA_Team::Attackers).Num()
        : CountHumansOnTeam(EBLA_Team::Attackers);
    const int32 DefenderMembers = TeamManager ? TeamManager->GetTeamMembers(EBLA_Team::Defenders).Num()
        : CountHumansOnTeam(EBLA_Team::Defenders);
    const int32 AttackerBotsNeeded = FMath::Max(0, TeamSize - AttackerMembers);
    const int32 DefenderBotsNeeded = FMath::Max(0, TeamSize - DefenderMembers);
    for (int32 Index = 0; Index < AttackerBotsNeeded; ++Index)
    {
        if (ABLAAIController* AI = SpawnBot(EBLA_Team::Attackers, Index + AttackerMembers, TEXT("AttackSpawn")))
        {
            OutAttackerBots.Add(AI);
        }
    }
    for (int32 Index = 0; Index < DefenderBotsNeeded; ++Index)
    {
        if (ABLAAIController* AI = SpawnBot(EBLA_Team::Defenders, Index + DefenderMembers, TEXT("DefenseSpawn")))
        {
            OutDefenderBots.Add(AI);
        }
    }
}

ABLAMapConfig* ABLAGameModeElimination::FindMapConfig() const
{
    for (TActorIterator<ABLAMapConfig> It(GetWorld()); It; ++It)
    {
        return *It;
    }
    return nullptr;
}

void ABLAGameModeElimination::InitializeMatch()
{
    ABLAPlayerCharacter* Player = Cast<ABLAPlayerCharacter>(GetWorld()->GetFirstPlayerController() ? GetWorld()->GetFirstPlayerController()->GetPawn() : nullptr);
    if (!Player || !TeamManager || !RoundManager || !TeamOrderManager || !RoleAssignment || !TacticalManager)
    {
        return;
    }
    const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    const int32 RequestedTeamSize = FMath::Clamp(GameInstance ? GameInstance->SelectedTeamSize : 1, 1, 3);
    EBLA_MatchMode Mode = GameInstance ? GameInstance->SelectedMode : EBLA_MatchMode::TeamElimination;

    // The map config is the source of truth for what a level supports (Task 11); the
    // tag-based search below stays as the fallback for maps that predate it.
    ABLAMapConfig* MapConfig = FindMapConfig();
    int32 TeamSize = RequestedTeamSize;
    if (MapConfig && MapConfig->Config)
    {
        if (!MapConfig->SupportsMode(Mode))
        {
            UE_LOG(LogTemp, Error, TEXT("BLA_MAP_CONFIG_MODE_UNSUPPORTED map=%s selected=%d"),
                *MapConfig->Config->MapId.ToString(), static_cast<int32>(Mode));
        }
        const int32 SupportedSize = MapConfig->ResolveSupportedTeamSize(RequestedTeamSize);
        if (SupportedSize != RequestedTeamSize)
        {
            UE_LOG(LogTemp, Warning, TEXT("BLA_MAP_CONFIG_SIZE_CLAMPED map=%s requested=%d used=%d"),
                *MapConfig->Config->MapId.ToString(), RequestedTeamSize, SupportedSize);
        }
        TeamSize = SupportedSize;
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("BLA_MAP_CONFIG_MISSING map=%s"), *GetWorld()->GetMapName());
    }

    Player->Team = EBLA_Team::Attackers;
    if (ABLASpawnPoint* AttackerSpawn = TeamManager->SelectSpawnPoint(EBLA_Team::Attackers, TEXT("AttackSpawn")))
    {
        Player->SetActorTransform(AttackerSpawn->GetActorTransform());
    }

    const bool bPlayerRegistered = TeamManager->RegisterCombatant(Player);
    const bool bPlayerEquipped = EquipLoadout(Player);
    TArray<ABLAAIController*> AttackerBots;
    TArray<ABLAAIController*> DefenderBots;
    bool bBotsReady = true;
    for (int32 Index = 0; Index < TeamSize - 1; ++Index)
    {
        ABLAAIController* AI = SpawnBot(EBLA_Team::Attackers, Index + 1, TEXT("AttackSpawn"));
        bBotsReady &= AI != nullptr;
        if (AI)
        {
            AttackerBots.Add(AI);
        }
    }
    for (int32 Index = 0; Index < TeamSize; ++Index)
    {
        ABLAAIController* AI = SpawnBot(EBLA_Team::Defenders, Index, TEXT("DefenseSpawn"));
        bBotsReady &= AI != nullptr;
        if (AI)
        {
            DefenderBots.Add(AI);
        }
    }
    if (!bPlayerRegistered || !bPlayerEquipped || !bBotsReady)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_ELIMINATION_MATCH_FAILED reason=registration_or_loadout player_registered=%d player_equipped=%d bots_ready=%d"),
            bPlayerRegistered, bPlayerEquipped, bBotsReady);
        return;
    }

    LaunchPreparedMatch(TeamSize, Mode, MapConfig, AttackerBots, DefenderBots, Player);
}

void ABLAGameModeElimination::LaunchPreparedMatch(int32 TeamSize, EBLA_MatchMode Mode, ABLAMapConfig* MapConfig,
    const TArray<ABLAAIController*>& AttackerBots, const TArray<ABLAAIController*>& DefenderBots,
    ABLAPlayerCharacter* OrderAnchor)
{
    RoleAssignment->AssignRoles(AttackerBots);
    RoleAssignment->AssignRoles(DefenderBots);
    ABLAPlayerCharacter* AttackerAnchor = OrderAnchor && OrderAnchor->Team == EBLA_Team::Attackers ? OrderAnchor : nullptr;
    for (ABLAAIController* AI : AttackerBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, AttackerAnchor);
    }
    for (ABLAAIController* AI : DefenderBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, nullptr);
    }
    if (OrderAnchor)
    {
        if (ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(OrderAnchor->GetController()))
        {
            PlayerController->ConfigureTeamSystems(TeamManager, TeamOrderManager);
        }
    }

    ABLAGameState* MatchState = GetGameState<ABLAGameState>();
    RoundManager->ConfigureManagers(MatchState, TeamManager, TeamOrderManager);
    if (MatchState)
    {
        MatchState->MatchMode = Mode;
    }
    int32 ObjectiveConfigured = 0;
    ABLAObjectiveManager* Objective = MapConfig ? MapConfig->ObjectiveManager : nullptr;
    if (!Objective)
    {
        for (TActorIterator<ABLAObjectiveManager> It(GetWorld()); It; ++It)
        {
            if (It->ActorHasTag(TEXT("BLALevelObjectiveManager")))
            {
                Objective = *It;
                break;
            }
        }
    }
    if (!Objective)
    {
        Objective = Cast<ABLAObjectiveManager>(UGameplayStatics::GetActorOfClass(this, ABLAObjectiveManager::StaticClass()));
    }
    if (Objective)
    {
        if (UIManager)
        {
            UIManager->SetObjectiveManager(Objective);
        }
        if (Mode == EBLA_MatchMode::DataCoreAttackDefense)
        {
            ABLADataCore* Core = MapConfig && MapConfig->DataCore ? MapConfig->DataCore : Objective->DataCore;
            ABLAObjectiveZone* Zone = MapConfig && MapConfig->ObjectiveZone ? MapConfig->ObjectiveZone : Objective->ObjectiveZone;
            Objective->Configure(MatchState, RoundManager, Core, Zone, TeamManager);
            for (ABLAAIController* AI : AttackerBots)
            {
                AI->ConfigureObjective(Objective, TacticalManager);
            }
            for (ABLAAIController* AI : DefenderBots)
            {
                AI->ConfigureObjective(Objective, TacticalManager);
            }
            ObjectiveConfigured = 1;
        }
        else
        {
            Objective->ResetObjective();
        }
    }

    RoundManager->StartMatch(ResolveRules(TeamSize));
    if (UIManager)
    {
        UIManager->Configure(this, RoundManager, TeamOrderManager);
        UIManager->OpenMatchHUD();
    }
    UE_LOG(LogTemp, Display, TEXT("BLA_ELIMINATION_MATCH_READY mode=team_elimination team_size=%d registration=%d attacker_bots=%d defender_bots=%d roles=deterministic loadouts=%d primary=pulse_rifle secondary=energy_pistol selected_mode=%d objective_configured=%d map_config=%d"),
        TeamSize, TeamSize * 2, AttackerBots.Num(), DefenderBots.Num(), TeamSize * 2,
        static_cast<int32>(Mode), ObjectiveConfigured, MapConfig && MapConfig->Config ? 1 : 0);
}

bool ABLAGameModeElimination::RestartMatch()
{
    ABLAGameState* State = GetGameState<ABLAGameState>();
    if (!RoundManager || !TeamManager || !State)
    {
        return false;
    }
    const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    const int32 TeamSize = FMath::Clamp(GameInstance ? GameInstance->SelectedTeamSize : 1, 1, 3);
    RoundManager->ConfigureManagers(State, TeamManager, TeamOrderManager);
    RoundManager->StartMatch(ResolveRules(TeamSize));
    RoundManager->ResetAllCombatants();
    if (UIManager)
    {
        UIManager->OpenMatchHUD();
    }
    UE_LOG(LogTemp, Display, TEXT("BLA_MATCH_RESTARTED team_size=%d"), TeamSize);
    return true;
}

ABLAAIController* ABLAGameModeElimination::SpawnBot(EBLA_Team Team, int32 TeamIndex, FName PreferredZone)
{
    ABLASpawnPoint* Spawn = TeamManager->SelectSpawnPoint(Team, PreferredZone);
    const float Side = Team == EBLA_Team::Attackers ? -1.0f : 1.0f;
    const FTransform Transform = Spawn ? Spawn->GetActorTransform()
        : FTransform(FRotator(0.0f, Team == EBLA_Team::Attackers ? 0.0f : 180.0f, 0.0f),
            FVector(Side * 900.0f, (TeamIndex - 1) * 250.0f, 120.0f));
    FActorSpawnParameters SpawnParameters;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    ABLABotCharacter* Bot = GetWorld()->SpawnActor<ABLABotCharacter>(ABLABotCharacter::StaticClass(), Transform, SpawnParameters);
    ABLAAIController* AI = Bot ? GetWorld()->SpawnActor<ABLAAIController>() : nullptr;
    if (!Bot || !AI)
    {
        if (Bot)
        {
            Bot->Destroy();
        }
        return nullptr;
    }
    Bot->Team = Team;
    AI->EliminationTree = LoadObject<UBehaviorTree>(nullptr, TEXT("/Game/BLA/AI/BehaviorTrees/BT_BLABotElimination.BT_BLABotElimination"));
    if (const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>())
    {
        AI->ApplyDifficulty(GameInstance->SelectedDifficulty);
    }
    AI->Possess(Bot);
    if (!TeamManager->RegisterCombatant(Bot) || !EquipLoadout(Bot))
    {
        AI->Destroy();
        Bot->Destroy();
        return nullptr;
    }
    return AI;
}

bool ABLAGameModeElimination::EquipLoadout(ABLACharacterBase* Combatant) const
{
    if (!Combatant || !Combatant->WeaponComponent)
    {
        return false;
    }
    UBLAWeaponDataAsset* Rifle = LoadObject<UBLAWeaponDataAsset>(nullptr, TEXT("/Game/BLA/Data/Weapons/DA_BLAWeapon_PulseRifle.DA_BLAWeapon_PulseRifle"));
    UBLAWeaponDataAsset* Pistol = LoadObject<UBLAWeaponDataAsset>(nullptr, TEXT("/Game/BLA/Data/Weapons/DA_BLAWeapon_EnergyPistol.DA_BLAWeapon_EnergyPistol"));
    return Rifle && Pistol
        && Combatant->WeaponComponent->EquipWeapon(ABLAWeaponBase::StaticClass(), Rifle, 0)
        && Combatant->WeaponComponent->EquipWeapon(ABLAWeaponBase::StaticClass(), Pistol, 1);
}

FBLAMatchRules ABLAGameModeElimination::ResolveRules(int32 TeamSize) const
{
    FBLAMatchRules Rules;
    const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    const bool bHasMatchingRules = GameInstance && GameInstance->SelectedRules
        && GameInstance->SelectedRules->Rules.TeamSize == TeamSize;
    if (bHasMatchingRules)
    {
        Rules = GameInstance->SelectedRules->Rules;
    }
    Rules.TeamSize = TeamSize;
    if (!bHasMatchingRules)
    {
        Rules.CombatSeconds = TeamSize == 1 ? 60.0f : TeamSize == 2 ? 75.0f : 90.0f;
        Rules.RoundsToWin = TeamSize == 1 ? 3 : TeamSize == 2 ? 4 : 5;
        Rules.SwitchSidesAfterRound = TeamSize == 3 ? 4 : 2;
    }
    return Rules;
}
