#include "BLATeamOrderManager.h"

#include "BLACharacterBase.h"

bool ABLATeamOrderManager::SubmitOrder(EBLA_TeamOrder Order, AActor* InIssuer, FVector InTargetLocation,
    EBLA_RoundPhase InPhase, float DurationSeconds)
{
    const ABLACharacterBase* Combatant = Cast<ABLACharacterBase>(InIssuer);
    if (!Combatant || !Combatant->GetIsAlive() || InPhase == EBLA_RoundPhase::Loading
        || InPhase == EBLA_RoundPhase::RoundResult || InPhase == EBLA_RoundPhase::MatchResult)
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

bool ABLATeamOrderManager::IsOrderActive(EBLA_RoundPhase Phase) const
{
    return bHasActiveOrder && IsValid(Issuer) && Phase == OrderPhase
        && GetWorld() && GetWorld()->GetTimeSeconds() <= PhaseExpiry;
}

void ABLATeamOrderManager::ClearOrder()
{
    CurrentOrder = EBLA_TeamOrder::FollowPlayer;
    Issuer = nullptr;
    TargetLocation = FVector::ZeroVector;
    OrderPhase = EBLA_RoundPhase::Loading;
    PhaseExpiry = 0.0f;
    bHasActiveOrder = false;
    OnOrderChanged.Broadcast(EBLA_RoundPhase::Loading);
}
