#include "FPSDataCore.h"

#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    constexpr float CoreCarryHeightOffset = 45.0f;
    constexpr float CoreDropHeightOffset = 20.0f;
}

AFPSDataCore::AFPSDataCore()
{
    PrimaryActorTick.bCanEverTick = false;

    CoreMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("CoreMesh"));
    SetRootComponent(CoreMesh);
    CoreMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
    CoreMesh->SetRelativeScale3D(FVector(0.5f, 0.5f, 0.5f));

    static ConstructorHelpers::FObjectFinder<UStaticMesh> CubeMesh(TEXT("/Engine/BasicShapes/Cube.Cube"));
    if (CubeMesh.Succeeded())
    {
        CoreMesh->SetStaticMesh(CubeMesh.Object);
    }
}

void AFPSDataCore::BeginPlay()
{
    Super::BeginPlay();
    HomeLocation = GetActorLocation();
}

bool AFPSDataCore::CanBePickedUp() const
{
    return State == EFPS_ObjectiveState::Available || State == EFPS_ObjectiveState::Dropped;
}

bool AFPSDataCore::GiveTo(AActor* NewCarrier)
{
    if (!NewCarrier || !CanBePickedUp())
    {
        return false;
    }
    Carrier = NewCarrier;
    State = EFPS_ObjectiveState::Carried;
    AttachToActor(NewCarrier, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
    SetActorRelativeLocation(FVector(0.0f, 0.0f, CoreCarryHeightOffset));
    return true;
}

AActor* AFPSDataCore::RemoveFromCarrier()
{
    AActor* PreviousCarrier = Carrier;
    Carrier = nullptr;
    DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    if (PreviousCarrier)
    {
        SetActorLocation(PreviousCarrier->GetActorLocation() + FVector(0.0f, 0.0f, CoreDropHeightOffset));
    }
    State = EFPS_ObjectiveState::Dropped;
    return PreviousCarrier;
}

void AFPSDataCore::ResetToHome()
{
    Carrier = nullptr;
    DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    SetActorLocation(HomeLocation);
    State = EFPS_ObjectiveState::Available;
}

bool AFPSDataCore::IsCarriedBy(AActor* Candidate) const
{
    return Candidate != nullptr && Carrier == Candidate;
}

void AFPSDataCore::SetObjectiveState(EFPS_ObjectiveState NewState)
{
    State = NewState;
}
