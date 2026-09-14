#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "FPSDataCore.generated.h"

class UStaticMeshComponent;

/**
 * Physical Data Core objective actor.
 *
 * It owns only its own carry state (who holds it, where it lies). Every match
 * rule - planting, defusing, uploading, round outcome - belongs to
 * AFPSObjectiveManager; this class deliberately exposes no completion API so
 * that no other system can finish the objective on its own.
 */
UCLASS(Blueprintable)
class FPS_API AFPSDataCore : public AActor
{
    GENERATED_BODY()

public:
    AFPSDataCore();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS|Objective")
    TObjectPtr<UStaticMeshComponent> CoreMesh;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    EFPS_ObjectiveState State = EFPS_ObjectiveState::Available;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    TObjectPtr<AActor> Carrier;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Objective")
    FVector HomeLocation = FVector::ZeroVector;

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    bool CanBePickedUp() const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    bool GiveTo(AActor* NewCarrier);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    AActor* RemoveFromCarrier();

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void ResetToHome();

    UFUNCTION(BlueprintPure, Category = "FPS|Objective")
    bool IsCarriedBy(AActor* Candidate) const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void SetObjectiveState(EFPS_ObjectiveState NewState);

protected:
    virtual void BeginPlay() override;
};
