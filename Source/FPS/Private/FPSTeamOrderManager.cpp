#include "FPSTeamOrderManager.h"

#include "FPSCharacterBase.h"

bool AFPSTeamOrderManager::SubmitOrder(EFPS_TeamOrder Order, AActor* InIssuer, FVector InTargetLocation,
    EFPS_RoundPhase InPhase, float DurationSeconds)
{
    const AFPSCharacterBase* Combatant = Cast<AFPSCharacterBase>(InIssuer);
    if (!Combatant || !Combatant->GetIsAlive() || InPhase == EFPS_RoundPhase::Loading
        || InPhase == EFPS_RoundPhase::RoundResult || InPhase == EFPS_RoundPhase::MatchResult)
    {
        return false;
    }

    CurrentOrder = Order;
    Issuer = InIssuer;
    TargetLocation = InTargetLocation;
    OrderPhase = InPhase;
    PhaseExpiry = GetWorld()->GetTimeSeconds() + FMath::Max(0.0f, DurationSeconds);
    bHasActiveOrder = true;
    OnOrderChanged.Broadcast(InPhase);
    return true;
}

bool AFPSTeamOrderManager::IsOrderActive(EFPS_RoundPhase Phase) const
{
    return bHasActiveOrder && IsValid(Issuer) && Phase == OrderPhase
        && GetWorld() && GetWorld()->GetTimeSeconds() <= PhaseExpiry;
}

void AFPSTeamOrderManager::ClearOrder()
{
    CurrentOrder = EFPS_TeamOrder::FollowPlayer;
    Issuer = nullptr;
    TargetLocation = FVector::ZeroVector;
    OrderPhase = EFPS_RoundPhase::Loading;
    PhaseExpiry = 0.0f;
    bHasActiveOrder = false;
    OnOrderChanged.Broadcast(EFPS_RoundPhase::Loading);
}
