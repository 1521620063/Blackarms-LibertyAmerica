#include "BLARoundManager.h"

#include "BLACharacterBase.h"
#include "BLADebugSubsystem.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLAObjectiveManager.h"
#include "BLASpawnPoint.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "Kismet/GameplayStatics.h"

ABLARoundManager::ABLARoundManager()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLARoundManager::BeginPlay()
{
    Super::BeginPlay();
    if (!BLAGameState)
    {
        BLAGameState = Cast<ABLAGameState>(UGameplayStatics::GetGameState(this));
    }
    if (!TeamManager)
    {
        TeamManager = Cast<ABLATeamManager>(UGameplayStatics::GetActorOfClass(this, ABLATeamManager::StaticClass()));
    }
    ConfigureManagers(BLAGameState, TeamManager);
}

void ABLARoundManager::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
    }
    Super::EndPlay(EndPlayReason);
}

void ABLARoundManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!BLAGameState || bIsRoundEnding || (BLAGameState->RoundPhase != EBLA_RoundPhase::Preparation && BLAGameState->RoundPhase != EBLA_RoundPhase::Combat))
    {
        return;
    }
    BLAGameState->RoundTimeRemaining = FMath::Max(0.0f, BLAGameState->RoundTimeRemaining - DeltaSeconds);
    PhaseElapsed += DeltaSeconds;
    if (BLAGameState->RoundTimeRemaining <= 0.0f)
    {
        if (BLAGameState->RoundPhase == EBLA_RoundPhase::Preparation)
        {
            StartCombatPhase();
        }
        else if (!(ObjectiveManager && ObjectiveManager->IsUploadInProgress()))
        {
            EvaluateTimeout();
        }
    }
    if (!bIsRoundEnding && PhaseElapsed >= WatchdogSeconds)
    {
        // Watchdog: a phase that outlives every rule timer would otherwise stall the match.
        UE_LOG(LogTemp, Warning, TEXT("ROUND_WATCHDOG_EXPIRED phase=%d elapsed=%.1f round=%d"),
            static_cast<int32>(BLAGameState->RoundPhase), PhaseElapsed, BLAGameState->CurrentRound);
        if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
        {
            Debug->ReportEvent(TEXT("ROUND_WATCHDOG_EXPIRED"),
                FString::Printf(TEXT("phase=%d round=%d elapsed=%.1f"),
                    static_cast<int32>(BLAGameState->RoundPhase), BLAGameState->CurrentRound, PhaseElapsed));
        }
        // EndRound already guards duplicate scoring through bIsRoundEnding.
        EndRound(EBLA_Team::Neutral, TEXT("RoundWatchdogExpired"));
    }
}

void ABLARoundManager::StartMatch(const FBLAMatchRules& Rules)
{
    if (!BLAGameState || !TeamManager)
    {
        return;
    }
    ActiveRules = Rules;
    BLAGameState->CurrentRound = 1;
    BLAGameState->AttackersScore = 0;
    BLAGameState->DefendersScore = 0;
    BLAGameState->AttackersTeamSize = Rules.TeamSize;
    BLAGameState->DefendersTeamSize = Rules.TeamSize;
    TeamManager->ConfiguredSlotsPerTeam = Rules.TeamSize;
    bIsRoundEnding = false;
    StartPreparationPhase();
}

void ABLARoundManager::StartPreparationPhase()
{
    bIsRoundEnding = false;
    bOvertimeUsed = false;
    PhaseElapsed = 0.0f;
    ResetCombatantPositions();
    BLAGameState->RoundPhase = EBLA_RoundPhase::Preparation;
    BLAGameState->RoundTimeRemaining = ActiveRules.PreparationSeconds;
    if (ObjectiveManager)
    {
        ObjectiveManager->HandlePreparationStart();
    }
}

void ABLARoundManager::ResetCombatantPositions()
{
    if (!TeamManager)
    {
        return;
    }
    // Every round starts from the team spawns again; without this combatants resume from
    // wherever the previous round ended.
    TeamManager->ResetReservations();
    for (ABLACharacterBase* Combatant : TeamManager->GetTeamMembers(EBLA_Team::Attackers))
    {
        if (ABLASpawnPoint* Spawn = TeamManager->SelectSpawnPoint(EBLA_Team::Attackers, NAME_None))
        {
            Combatant->SetActorTransform(Spawn->GetActorTransform());
        }
    }
    for (ABLACharacterBase* Combatant : TeamManager->GetTeamMembers(EBLA_Team::Defenders))
    {
        if (ABLASpawnPoint* Spawn = TeamManager->SelectSpawnPoint(EBLA_Team::Defenders, NAME_None))
        {
            Combatant->SetActorTransform(Spawn->GetActorTransform());
        }
    }
}

void ABLARoundManager::StartCombatPhase()
{
    bIsRoundEnding = false;
    PhaseElapsed = 0.0f;
    BLAGameState->RoundPhase = EBLA_RoundPhase::Combat;
    BLAGameState->RoundTimeRemaining = ActiveRules.CombatSeconds;
}

bool ABLARoundManager::EndRound(EBLA_Team Winner, FName Reason)
{
    if (!BLAGameState || bIsRoundEnding || BLAGameState->RoundPhase == EBLA_RoundPhase::RoundResult || BLAGameState->RoundPhase == EBLA_RoundPhase::MatchResult)
    {
        return false;
    }
    bIsRoundEnding = true;
    LastResult = NewObject<UBLARoundResultData>(this);
    LastResult->Winner = Winner;
    LastResult->Reason = Reason;
    if (Winner == EBLA_Team::Attackers)
    {
        ++BLAGameState->AttackersScore;
    }
    else if (Winner == EBLA_Team::Defenders)
    {
        ++BLAGameState->DefendersScore;
    }
    if (BLAGameState->AttackersScore >= ActiveRules.RoundsToWin || BLAGameState->DefendersScore >= ActiveRules.RoundsToWin)
    {
        EndMatch(Winner);
    }
    else
    {
        BLAGameState->RoundPhase = EBLA_RoundPhase::RoundResult;
    }
    if (ObjectiveManager)
    {
        ObjectiveManager->HandleRoundEnding();
    }
    return true;
}

void ABLARoundManager::SwitchSidesIfRequired()
{
    if (ActiveRules.SwitchSidesAfterRound <= 0 || BLAGameState->CurrentRound % ActiveRules.SwitchSidesAfterRound != 0)
    {
        return;
    }
    const TArray<ABLACharacterBase*> Attackers = TeamManager->GetTeamMembers(EBLA_Team::Attackers);
    const TArray<ABLACharacterBase*> Defenders = TeamManager->GetTeamMembers(EBLA_Team::Defenders);
    for (ABLACharacterBase* Combatant : Attackers)
    {
        Combatant->Team = EBLA_Team::Defenders;
    }
    for (ABLACharacterBase* Combatant : Defenders)
    {
        Combatant->Team = EBLA_Team::Attackers;
    }
}

void ABLARoundManager::StartNextRound()
{
    if (!BLAGameState || BLAGameState->RoundPhase == EBLA_RoundPhase::MatchResult)
    {
        return;
    }
    SwitchSidesIfRequired();
    ++BLAGameState->CurrentRound;
    ResetAllCombatants();
    StartPreparationPhase();
}

void ABLARoundManager::EndMatch(EBLA_Team Winner)
{
    BLAGameState->RoundPhase = EBLA_RoundPhase::MatchResult;
    BLAGameState->RoundTimeRemaining = 0.0f;
    if (ObjectiveManager)
    {
        ObjectiveManager->HandleRoundEnding();
    }
}

void ABLARoundManager::ResetAllCombatants()
{
    for (ABLACharacterBase* Combatant : TeamManager->GetTeamMembers(EBLA_Team::Attackers))
    {
        Combatant->ResetCombatant();
    }
    for (ABLACharacterBase* Combatant : TeamManager->GetTeamMembers(EBLA_Team::Defenders))
    {
        Combatant->ResetCombatant();
    }
    TeamManager->ResetReservations();
    if (TeamOrderManager)
    {
        TeamOrderManager->ClearOrder();
    }
}

FBLAMatchRules ABLARoundManager::GetActiveRules() const
{
    return ActiveRules;
}

void ABLARoundManager::HandleCombatantDeath(ABLACharacterBase* DeadCombatant, AActor* InstigatorActor)
{
    if (!BLAGameState || BLAGameState->RoundPhase != EBLA_RoundPhase::Combat || bIsRoundEnding)
    {
        return;
    }
    if (TeamManager->GetLivingCount(DeadCombatant->Team) == 0)
    {
        EndRound(ABLATeamManager::GetOpposingTeam(DeadCombatant->Team), TEXT("Elimination"));
    }
}

void ABLARoundManager::ConfigureManagers(ABLAGameState* InGameState, ABLATeamManager* InTeamManager,
    ABLATeamOrderManager* InOrderManager)
{
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
    }
    BLAGameState = InGameState;
    TeamManager = InTeamManager;
    TeamOrderManager = InOrderManager;
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.AddUObject(this, &ABLARoundManager::HandleCombatantDeath);
    }
}

void ABLARoundManager::EvaluateTimeout()
{
    const int32 AttackersAlive = TeamManager->GetLivingCount(EBLA_Team::Attackers);
    const int32 DefendersAlive = TeamManager->GetLivingCount(EBLA_Team::Defenders);
    if (AttackersAlive != DefendersAlive)
    {
        EndRound(AttackersAlive > DefendersAlive ? EBLA_Team::Attackers : EBLA_Team::Defenders, TEXT("TimeoutLivingCount"));
        return;
    }
    const float AttackersHealth = GetRemainingHealth(EBLA_Team::Attackers);
    const float DefendersHealth = GetRemainingHealth(EBLA_Team::Defenders);
    if (!FMath::IsNearlyEqual(AttackersHealth, DefendersHealth))
    {
        EndRound(AttackersHealth > DefendersHealth ? EBLA_Team::Attackers : EBLA_Team::Defenders, TEXT("TimeoutHealth"));
        return;
    }
    if (!bOvertimeUsed)
    {
        bOvertimeUsed = true;
        BLAGameState->RoundTimeRemaining = 15.0f;
        return;
    }
    EndRound(EBLA_Team::Neutral, TEXT("OvertimeDraw"));
}

float ABLARoundManager::GetRemainingHealth(EBLA_Team Team) const
{
    float Total = 0.0f;
    for (const ABLACharacterBase* Combatant : TeamManager->GetTeamMembers(Team))
    {
        if (Combatant->HealthComponent && !Combatant->HealthComponent->bIsDead)
        {
            Total += Combatant->HealthComponent->CurrentHealth;
        }
    }
    return Total;
}
