#pragma once

#include "GameFramework/Actor.h"
#include "BLAMapZone.generated.h"

class UBoxComponent;

UENUM(BlueprintType)
enum class EBLA_MapZoneType : uint8
{
    AttackSpawn,
    LeftRoute,
    CenterRoute,
    RightRoute,
    MidCombatZone,
    ObjectiveZone,
    FlankZone,
    DefenseSpawn
};

/**
 * Spatial description of one Zero Facility zone. Zones are pure geometry: spawn points,
 * tactical points and cover live as their own actors inside them.
 */
UCLASS(Blueprintable)
class BLA_API ABLAMapZone : public AActor
{
    GENERATED_BODY()

public:
    ABLAMapZone();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TObjectPtr<UBoxComponent> ZoneBounds;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Map")
    EBLA_MapZoneType ZoneType = EBLA_MapZoneType::CenterRoute;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Map")
    FName ZoneName = TEXT("CenterRoute");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Map")
    FVector ZoneExtent = FVector(400.0f, 400.0f, 250.0f);

    UFUNCTION(BlueprintPure, Category = "BLA|Map")
    bool ContainsActor(AActor* Actor) const;

    UFUNCTION(BlueprintPure, Category = "BLA|Map")
    bool ContainsLocation(const FVector& Location) const;

protected:
    virtual void OnConstruction(const FTransform& Transform) override;
};
