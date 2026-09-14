#include "BLAHitFeedbackComponent.h"

void UBLAHitFeedbackComponent::ReportHit(float AppliedDamage, bool bKilled)
{
    OnHitConfirmed.Broadcast(AppliedDamage, bKilled);
}
