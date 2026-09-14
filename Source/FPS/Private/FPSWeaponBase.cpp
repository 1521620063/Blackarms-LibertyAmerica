#include "FPSWeaponBase.h"

#include "Components/SceneComponent.h"

AFPSWeaponBase::AFPSWeaponBase()
{
    PrimaryActorTick.bCanEverTick = false;
    USceneComponent* Root = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
    SetRootComponent(Root);
    Muzzle = CreateDefaultSubobject<USceneComponent>(TEXT("Muzzle"));
    Muzzle->SetupAttachment(Root);
}
