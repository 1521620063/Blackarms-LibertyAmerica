#include "BLATacticalPoint.h"

#include "Components/SceneComponent.h"

ABLATacticalPoint::ABLATacticalPoint()
{
    PrimaryActorTick.bCanEverTick = false;
    // The editor only persists a placed actor's transform when the actor has a
    // root component. Without this every tactical point serialized at the world
    // origin, which collapsed the AI onto one choke point on Zero Facility.
    USceneComponent* PointRoot = CreateDefaultSubobject<USceneComponent>(TEXT("PointRoot"));
    SetRootComponent(PointRoot);
}
