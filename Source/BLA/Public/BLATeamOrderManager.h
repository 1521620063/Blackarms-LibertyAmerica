#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLATeamOrderManager.generated.h"

DECLARE_MULTICAST_DELEGATE_OneParam(FBLATeamOrderChangedSignature, EBLA_RoundPhase);

UCLASS(Blueprintable)
class BLA_API ABLATeamOrderManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|Orders")
    bool SubmitOrder(EBLA_TeamOrder Order, AActor* InIssuer, FVector InTargetLocation,
        EBLA_RoundPhase InPhase, float DurationSeconds);

    UFUNCTION(BlueprintPure, Category = "BLA|Orders")
    bool IsOrderActive(EBLA_RoundPhase Phase) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Orders")
    void ClearOrder();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Orders")
    EBLA_TeamOrder CurrentOrder = EBLA_TeamOrder::FollowPlayer;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Orders")
    TObjectPtr<AActor> Issuer;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Orders")
    FVector TargetLocation = FVector::ZeroVector;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Orders")
    EBLA_RoundPhase OrderPhase = EBLA_RoundPhase::Loading;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Orders")
    float PhaseExpiry = 0.0f;

    FBLATeamOrderChangedSignature OnOrderChanged;

private:
    bool bHasActiveOrder = false;
};
