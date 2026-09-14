#include "BLAObjectiveZone.h"

#include "Components/BoxComponent.h"

ABLAObjectiveZone::ABLAObjectiveZone()
{
    PrimaryActorTick.bCanEverTick = false;

    ZoneBounds = CreateDefaultSubobject<UBoxComponent>(TEXT("ZoneBounds"));
    SetRootComponent(ZoneBounds);
    ZoneBounds->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    ZoneBounds->SetBoxExtent(ZoneExtent);
}

void ABLAObjectiveZone::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    if (ZoneBounds)
    {
        ZoneBounds->SetBoxExtent(ZoneExtent);
    }
}

bool ABLAObjectiveZone::ContainsActor(AActor* Actor) const
{
    return Actor != nullptr && ContainsLocation(Actor->GetActorLocation());
}

bool ABLAObjectiveZone::ContainsLocation(const FVector& Location) const
{
    const FVector LocalLocation = GetActorTransform().InverseTransformPosition(Location);
    return FMath::Abs(LocalLocation.X) <= ZoneExtent.X
        && FMath::Abs(LocalLocation.Y) <= ZoneExtent.Y
        && FMath::Abs(LocalLocation.Z) <= ZoneExtent.Z;
}
