#pragma once

#include "GameFramework/Actor.h"
#include "FPSWeaponBase.generated.h"

class UFPSWeaponDataAsset;
class USceneComponent;

UCLASS(Blueprintable)
class FPS_API AFPSWeaponBase : public AActor
{
    GENERATED_BODY()

public:
    AFPSWeaponBase();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Weapon")
    TObjectPtr<USceneComponent> Muzzle;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Weapon")
    TObjectPtr<UFPSWeaponDataAsset> WeaponDataAsset;
};
