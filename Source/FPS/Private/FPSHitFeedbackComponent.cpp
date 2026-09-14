#include "FPSHitFeedbackComponent.h"

void UFPSHitFeedbackComponent::ReportHit(float AppliedDamage, bool bKilled)
{
    OnHitConfirmed.Broadcast(AppliedDamage, bKilled);
}
