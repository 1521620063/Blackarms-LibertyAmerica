#include "BLAGameState.h"

#include "Net/UnrealNetwork.h"

ABLAGameState::ABLAGameState()
{
    bReplicates = true;
}

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
