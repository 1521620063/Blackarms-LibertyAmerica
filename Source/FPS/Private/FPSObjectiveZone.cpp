#include "FPSObjectiveZone.h"

#include "Components/BoxComponent.h"

AFPSObjectiveZone::AFPSObjectiveZone()
{
    PrimaryActorTick.bCanEverTick = false;

    ZoneBounds = CreateDefaultSubobject<UBoxComponent>(TEXT("ZoneBounds"));
    SetRootComponent(ZoneBounds);
    ZoneBounds->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    ZoneBounds->SetBoxExtent(ZoneExtent);
}

void AFPSObjectiveZone::OnConstruction(const FTransform& Transform)
{
    Super::OnConstruction(Transform);
    if (ZoneBounds)
    {
        ZoneBounds->SetBoxExtent(ZoneExtent);
    }
}

bool AFPSObjectiveZone::ContainsActor(AActor* Actor) const
{
    return Actor != nullptr && ContainsLocation(Actor->GetActorLocation());
}

bool AFPSObjectiveZone::ContainsLocation(const FVector& Location) const
{
    const FVector LocalLocation = GetActorTransform().InverseTransformPosition(Location);
    return FMath::Abs(LocalLocation.X) <= ZoneExtent.X
        && FMath::Abs(LocalLocation.Y) <= ZoneExtent.Y
        && FMath::Abs(LocalLocation.Z) <= ZoneExtent.Z;
}
