#pragma once

#include "Components/ActorComponent.h"
#include "FPSHitFeedbackComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FFPSHitFeedbackSignature, float, AppliedDamage, bool, bKilled);

UCLASS(Blueprintable, ClassGroup = "FPS", meta = (BlueprintSpawnableComponent))
class FPS_API UFPSHitFeedbackComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable, Category = "FPS|Feedback")
    FFPSHitFeedbackSignature OnHitConfirmed;

    UFUNCTION(BlueprintCallable, Category = "FPS|Feedback")
    void ReportHit(float AppliedDamage, bool bKilled);
};
