#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "FPSTeamOrderManager.generated.h"

DECLARE_MULTICAST_DELEGATE_OneParam(FFPSTeamOrderChangedSignature, EFPS_RoundPhase);

UCLASS(Blueprintable)
class FPS_API AFPSTeamOrderManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|Orders")
    bool SubmitOrder(EFPS_TeamOrder Order, AActor* InIssuer, FVector InTargetLocation,
        EFPS_RoundPhase InPhase, float DurationSeconds);

    UFUNCTION(BlueprintPure, Category = "FPS|Orders")
    bool IsOrderActive(EFPS_RoundPhase Phase) const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Orders")
    void ClearOrder();

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Orders")
    EFPS_TeamOrder CurrentOrder = EFPS_TeamOrder::FollowPlayer;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Orders")
    TObjectPtr<AActor> Issuer;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Orders")
    FVector TargetLocation = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Orders")
    EFPS_RoundPhase OrderPhase = EFPS_RoundPhase::Loading;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Orders")
    float PhaseExpiry = 0.0f;

    FFPSTeamOrderChangedSignature OnOrderChanged;

private:
    bool bHasActiveOrder = false;
};
