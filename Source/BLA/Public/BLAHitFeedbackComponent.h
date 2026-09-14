#pragma once

#include "Components/ActorComponent.h"
#include "BLAHitFeedbackComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FBLAHitFeedbackSignature, float, AppliedDamage, bool, bKilled);

UCLASS(Blueprintable, ClassGroup = "BLA", meta = (BlueprintSpawnableComponent))
class BLA_API UBLAHitFeedbackComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintAssignable, Category = "BLA|Feedback")
    FBLAHitFeedbackSignature OnHitConfirmed;

    UFUNCTION(BlueprintCallable, Category = "BLA|Feedback")
    void ReportHit(float AppliedDamage, bool bKilled);
};
