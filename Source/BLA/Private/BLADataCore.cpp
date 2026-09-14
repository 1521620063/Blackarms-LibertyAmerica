#include "BLADataCore.h"

#include "Components/StaticMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
    constexpr float CoreCarryHeightOffset = 45.0f;
    constexpr float CoreDropHeightOffset = 20.0f;
}

ABLADataCore::ABLADataCore()
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

void ABLADataCore::BeginPlay()
{
    Super::BeginPlay();
    HomeLocation = GetActorLocation();
}

bool ABLADataCore::CanBePickedUp() const
{
    return State == EBLA_ObjectiveState::Available || State == EBLA_ObjectiveState::Dropped;
}

bool ABLADataCore::GiveTo(AActor* NewCarrier)
{
    if (!NewCarrier || !CanBePickedUp())
    {
        return false;
    }
    Carrier = NewCarrier;
    State = EBLA_ObjectiveState::Carried;
    AttachToActor(NewCarrier, FAttachmentTransformRules::SnapToTargetNotIncludingScale);
    SetActorRelativeLocation(FVector(0.0f, 0.0f, CoreCarryHeightOffset));
    return true;
}

AActor* ABLADataCore::RemoveFromCarrier()
{
    AActor* PreviousCarrier = Carrier;
    Carrier = nullptr;
    DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    if (PreviousCarrier)
    {
        SetActorLocation(PreviousCarrier->GetActorLocation() + FVector(0.0f, 0.0f, CoreDropHeightOffset));
    }
    State = EBLA_ObjectiveState::Dropped;
    return PreviousCarrier;
}

void ABLADataCore::ResetToHome()
{
    Carrier = nullptr;
    DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    SetActorLocation(HomeLocation);
    State = EBLA_ObjectiveState::Available;
}

bool ABLADataCore::IsCarriedBy(AActor* Candidate) const
{
    return Candidate != nullptr && Carrier == Candidate;
}

void ABLADataCore::SetObjectiveState(EBLA_ObjectiveState NewState)
{
    State = NewState;
}
