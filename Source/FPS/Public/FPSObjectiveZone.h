#pragma once

#include "GameFramework/Actor.h"
#include "FPSObjectiveZone.generated.h"

class UBoxComponent;

/**
 * Plant/upload volume for the Data Core objective. Purely spatial: it answers
 * whether an actor or a location is inside the objective area and never decides
 * any objective outcome.
 */
UCLASS(Blueprintable)
class FPS_API AFPSObjectiveZone : public AActor
{
    GENERATED_BODY()

public:
    AFPSObjectiveZone();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS|Objective")
    TObjectPtr<UBoxComponent> ZoneBounds;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Objective")
    FVector ZoneExtent = FVector(300.0f, 300.0f, 200.0f);

    UFUNCTION(BlueprintPure, Category = "FPS|Objective")
    bool ContainsActor(AActor* Actor) const;

    bool ContainsLocation(const FVector& Location) const;

protected:
    virtual void OnConstruction(const FTransform& Transform) override;
};
