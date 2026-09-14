#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLADataCore.generated.h"

class UStaticMeshComponent;

/**
 * Physical Data Core objective actor.
 *
 * It owns only its own carry state (who holds it, where it lies). Every match
 * rule - planting, defusing, uploading, round outcome - belongs to
 * ABLAObjectiveManager; this class deliberately exposes no completion API so
 * that no other system can finish the objective on its own.
 */
UCLASS(Blueprintable)
class BLA_API ABLADataCore : public AActor
{
    GENERATED_BODY()

public:
    ABLADataCore();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA|Objective")
    TObjectPtr<UStaticMeshComponent> CoreMesh;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    EBLA_ObjectiveState State = EBLA_ObjectiveState::Available;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    TObjectPtr<AActor> Carrier;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Objective")
    FVector HomeLocation = FVector::ZeroVector;

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    bool CanBePickedUp() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    bool GiveTo(AActor* NewCarrier);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    AActor* RemoveFromCarrier();

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void ResetToHome();

    UFUNCTION(BlueprintPure, Category = "BLA|Objective")
    bool IsCarriedBy(AActor* Candidate) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void SetObjectiveState(EBLA_ObjectiveState NewState);

protected:
    virtual void BeginPlay() override;
};
