#include "FPSRoundManager.h"

#include "FPSCharacterBase.h"
#include "FPSGameState.h"
#include "FPSHealthComponent.h"
#include "FPSTeamManager.h"
#include "FPSTeamOrderManager.h"
#include "Kismet/GameplayStatics.h"

AFPSRoundManager::AFPSRoundManager()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AFPSRoundManager::BeginPlay()
{
    Super::BeginPlay();
    if (!FPSGameState)
    {
        FPSGameState = Cast<AFPSGameState>(UGameplayStatics::GetGameState(this));
    }
    if (!TeamManager)
    {
        TeamManager = Cast<AFPSTeamManager>(UGameplayStatics::GetActorOfClass(this, AFPSTeamManager::StaticClass()));
    }
    ConfigureManagers(FPSGameState, TeamManager);
}

void AFPSRoundManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (!FPSGameState || bIsRoundEnding || (FPSGameState->RoundPhase != EFPS_RoundPhase::Preparation && FPSGameState->RoundPhase != EFPS_RoundPhase::Combat))
    {
        return;
    }
    FPSGameState->RoundTimeRemaining = FMath::Max(0.0f, FPSGameState->RoundTimeRemaining - DeltaSeconds);
    if (FPSGameState->RoundTimeRemaining <= 0.0f)
    {
        if (FPSGameState->RoundPhase == EFPS_RoundPhase::Preparation)
        {
            StartCombatPhase();
        }
        else
        {
            EvaluateTimeout();
        }
    }
}

void AFPSRoundManager::StartMatch(const FFPSMatchRules& Rules)
{
    if (!FPSGameState || !TeamManager)
    {
        return;
    }
    ActiveRules = Rules;
    FPSGameState->CurrentRound = 1;
    FPSGameState->AttackersScore = 0;
    FPSGameState->DefendersScore = 0;
    FPSGameState->AttackersTeamSize = Rules.TeamSize;
    FPSGameState->DefendersTeamSize = Rules.TeamSize;
    TeamManager->ConfiguredSlotsPerTeam = Rules.TeamSize;
    bIsRoundEnding = false;
    StartPreparationPhase();
}

void AFPSRoundManager::StartPreparationPhase()
{
    bIsRoundEnding = false;
    bOvertimeUsed = false;
    FPSGameState->RoundPhase = EFPS_RoundPhase::Preparation;
    FPSGameState->RoundTimeRemaining = ActiveRules.PreparationSeconds;
}

void AFPSRoundManager::StartCombatPhase()
{
    bIsRoundEnding = false;
    FPSGameState->RoundPhase = EFPS_RoundPhase::Combat;
    FPSGameState->RoundTimeRemaining = ActiveRules.CombatSeconds;
}

bool AFPSRoundManager::EndRound(EFPS_Team Winner, FName Reason)
{
    if (!FPSGameState || bIsRoundEnding || FPSGameState->RoundPhase == EFPS_RoundPhase::RoundResult || FPSGameState->RoundPhase == EFPS_RoundPhase::MatchResult)
    {
        return false;
    }
    bIsRoundEnding = true;
    LastResult = NewObject<UFPSRoundResultData>(this);
    LastResult->Winner = Winner;
    LastResult->Reason = Reason;
    if (Winner == EFPS_Team::Attackers)
    {
        ++FPSGameState->AttackersScore;
    }
    else if (Winner == EFPS_Team::Defenders)
    {
        ++FPSGameState->DefendersScore;
    }
    if (FPSGameState->AttackersScore >= ActiveRules.RoundsToWin || FPSGameState->DefendersScore >= ActiveRules.RoundsToWin)
    {
        EndMatch(Winner);
    }
    else
    {
        FPSGameState->RoundPhase = EFPS_RoundPhase::RoundResult;
    }
    return true;
}

void AFPSRoundManager::SwitchSidesIfRequired()
{
    if (ActiveRules.SwitchSidesAfterRound <= 0 || FPSGameState->CurrentRound % ActiveRules.SwitchSidesAfterRound != 0)
    {
        return;
    }
    const TArray<AFPSCharacterBase*> Attackers = TeamManager->GetTeamMembers(EFPS_Team::Attackers);
    const TArray<AFPSCharacterBase*> Defenders = TeamManager->GetTeamMembers(EFPS_Team::Defenders);
    for (AFPSCharacterBase* Combatant : Attackers)
    {
        Combatant->Team = EFPS_Team::Defenders;
    }
    for (AFPSCharacterBase* Combatant : Defenders)
    {
        Combatant->Team = EFPS_Team::Attackers;
    }
}

void AFPSRoundManager::StartNextRound()
{
    if (!FPSGameState || FPSGameState->RoundPhase == EFPS_RoundPhase::MatchResult)
    {
        return;
    }
    SwitchSidesIfRequired();
    ++FPSGameState->CurrentRound;
    ResetAllCombatants();
    StartPreparationPhase();
}

void AFPSRoundManager::EndMatch(EFPS_Team Winner)
{
    FPSGameState->RoundPhase = EFPS_RoundPhase::MatchResult;
    FPSGameState->RoundTimeRemaining = 0.0f;
}

void AFPSRoundManager::ResetAllCombatants()
{
    for (AFPSCharacterBase* Combatant : TeamManager->GetTeamMembers(EFPS_Team::Attackers))
    {
        Combatant->ResetCombatant();
    }
    for (AFPSCharacterBase* Combatant : TeamManager->GetTeamMembers(EFPS_Team::Defenders))
    {
        Combatant->ResetCombatant();
    }
    TeamManager->ResetReservations();
    if (TeamOrderManager)
    {
        TeamOrderManager->ClearOrder();
    }
}

FFPSMatchRules AFPSRoundManager::GetActiveRules() const
{
    return ActiveRules;
}

void AFPSRoundManager::HandleCombatantDeath(AFPSCharacterBase* DeadCombatant, AActor* InstigatorActor)
{
    if (!FPSGameState || FPSGameState->RoundPhase != EFPS_RoundPhase::Combat || bIsRoundEnding)
    {
        return;
    }
    if (TeamManager->GetLivingCount(DeadCombatant->Team) == 0)
    {
        EndRound(AFPSTeamManager::GetOpposingTeam(DeadCombatant->Team), TEXT("Elimination"));
    }
}

void AFPSRoundManager::ConfigureManagers(AFPSGameState* InGameState, AFPSTeamManager* InTeamManager,
    AFPSTeamOrderManager* InOrderManager)
{
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
    }
    FPSGameState = InGameState;
    TeamManager = InTeamManager;
    TeamOrderManager = InOrderManager;
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.AddUObject(this, &AFPSRoundManager::HandleCombatantDeath);
    }
}

void AFPSRoundManager::EvaluateTimeout()
{
    const int32 AttackersAlive = TeamManager->GetLivingCount(EFPS_Team::Attackers);
    const int32 DefendersAlive = TeamManager->GetLivingCount(EFPS_Team::Defenders);
    if (AttackersAlive != DefendersAlive)
    {
        EndRound(AttackersAlive > DefendersAlive ? EFPS_Team::Attackers : EFPS_Team::Defenders, TEXT("TimeoutLivingCount"));
        return;
    }
    const float AttackersHealth = GetRemainingHealth(EFPS_Team::Attackers);
    const float DefendersHealth = GetRemainingHealth(EFPS_Team::Defenders);
    if (!FMath::IsNearlyEqual(AttackersHealth, DefendersHealth))
    {
        EndRound(AttackersHealth > DefendersHealth ? EFPS_Team::Attackers : EFPS_Team::Defenders, TEXT("TimeoutHealth"));
        return;
    }
    if (!bOvertimeUsed)
    {
        bOvertimeUsed = true;
        FPSGameState->RoundTimeRemaining = 15.0f;
        return;
    }
    EndRound(EFPS_Team::Neutral, TEXT("OvertimeDraw"));
}

float AFPSRoundManager::GetRemainingHealth(EFPS_Team Team) const
{
    float Total = 0.0f;
    for (const AFPSCharacterBase* Combatant : TeamManager->GetTeamMembers(Team))
    {
        if (Combatant->HealthComponent && !Combatant->HealthComponent->bIsDead)
        {
            Total += Combatant->HealthComponent->CurrentHealth;
        }
    }
    return Total;
}
