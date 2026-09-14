#pragma once

#include "GameFramework/Actor.h"
#include "BLAWeaponBase.generated.h"

class UBLAWeaponDataAsset;
class USceneComponent;

UCLASS(Blueprintable)
class BLA_API ABLAWeaponBase : public AActor
{
    GENERATED_BODY()

public:
    ABLAWeaponBase();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Weapon")
    TObjectPtr<USceneComponent> Muzzle;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Weapon")
    TObjectPtr<UBLAWeaponDataAsset> WeaponDataAsset;
};
