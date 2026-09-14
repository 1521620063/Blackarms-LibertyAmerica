#include "BLAWeaponBase.h"

#include "Components/SceneComponent.h"

ABLAWeaponBase::ABLAWeaponBase()
{
    PrimaryActorTick.bCanEverTick = false;
    USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);
    Muzzle = CreateDefaultSubobject<USceneComponent>(TEXT("Muzzle"));
    Muzzle->SetupAttachment(Root);
}
