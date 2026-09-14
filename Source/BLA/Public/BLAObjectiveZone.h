#pragma once

#include "GameFramework/Actor.h"
#include "BLAObjectiveZone.generated.h"

class UBoxComponent;

/**
 * Plant/upload volume for the Data Core objective. Purely spatial: it answers
 * whether an actor or a location is inside the objective area and never decides
 * any objective outcome.
 */
UCLASS(Blueprintable)
class BLA_API ABLAObjectiveZone : public AActor
{
    GENERATED_BODY()

public:
    ABLAObjectiveZone();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA|Objective")
    TObjectPtr<UBoxComponent> ZoneBounds;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Objective")
    FVector ZoneExtent = FVector(300.0f, 300.0f, 200.0f);

    UFUNCTION(BlueprintPure, Category = "BLA|Objective")
    bool ContainsActor(AActor* Actor) const;

    bool ContainsLocation(const FVector& Location) const;

protected:
    virtual void OnConstruction(const FTransform& Transform) override;
};
