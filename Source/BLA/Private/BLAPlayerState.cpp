#include "BLAPlayerState.h"

#include "Net/UnrealNetwork.h"

ABLAPlayerState::ABLAPlayerState()
{
    bReplicates = true;
}

void ABLAPlayerState::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ABLAPlayerState, Team);
    DOREPLIFETIME(ABLAPlayerState, bIsLANHost);
    DOREPLIFETIME(ABLAPlayerState, DeathState);
    DOREPLIFETIME(ABLAPlayerState, Kills);
    DOREPLIFETIME(ABLAPlayerState, Deaths);
    DOREPLIFETIME(ABLAPlayerState, DamageDealt);
    DOREPLIFETIME(ABLAPlayerState, ObjectiveContribution);
}
