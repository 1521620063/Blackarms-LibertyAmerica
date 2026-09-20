#include "BLAGameModeElimination.h"
#include "BLAAIController.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BLACharacterBase.h"
#include "BLAGameInstance.h"
#include "BLAGameState.h"
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
        EnterLANWaiting();
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
        PlayerController->UnPossess();
    }
    RefreshLANRoster();
    if (UIManager)
    {
        UIManager->Configure(this, RoundManager, TeamOrderManager);
    }
    UE_LOG(LogTemp, Display, TEXT("BLA_LAN_WAITING_ENTERED team_size=%d"),
        GameInstance ? GameInstance->SelectedTeamSize : 0);
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
    if (State && State->RoundPhase == EBLA_RoundPhase::Loading && CountHumans() == 1)
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
        if (GameSession)
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
    Super::Logout(Exiting);
    if (!IsLANListenMatch())
    {
        return;
    }
    RefreshLANRoster();
    if (bHostLeft)
    {
        for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
        {
            if (ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(It->Get()))
            {
                PlayerController->ClientNotifyFlowError(TEXT("FLOW_LAN_HOST_LEFT"));
            }
        }
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
    return true;
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
    ABLAMapConfig* MapConfig = nullptr;
    for (TActorIterator<ABLAMapConfig> It(GetWorld()); It; ++It)
    {
        MapConfig = *It;
        break;
    }
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

    RoleAssignment->AssignRoles(AttackerBots);
    RoleAssignment->AssignRoles(DefenderBots);
    for (ABLAAIController* AI : AttackerBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, Player);
    }
    for (ABLAAIController* AI : DefenderBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, nullptr);
    }
    if (ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(Player->GetController()))
    {
        PlayerController->ConfigureTeamSystems(TeamManager, TeamOrderManager);
    }
    // One state pointer for the whole match: the functional tests in these maps spawn their
    // own AGameStateBase actors, so the world pointer is not a reliable match state.
    ABLAGameState* MatchState = GetGameState<ABLAGameState>();
    RoundManager->ConfigureManagers(MatchState, TeamManager, TeamOrderManager);

    // Mode selection belongs to the player flow: TeamElimination leaves the map's objective
    // actors inert, DataCoreAttackDefense hands them to the objective manager and the bots.
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
        Objective = Cast<ABLAObjectiveManager>(
            UGameplayStatics::GetActorOfClass(this, ABLAObjectiveManager::StaticClass()));
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
