#pragma once

#include "FPSGameplayTypes.h"
#include "Engine/DataAsset.h"
#include "FPSWeaponTypes.generated.h"

USTRUCT(BlueprintType)
struct FPS_API FFPSWeaponData
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
    EFPS_WeaponType WeaponType = EFPS_WeaponType::EnergyPistol;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Damage", meta = (ClampMin = "0.0"))
    float BaseDamage = 20.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Damage", meta = (ClampMin = "0.0"))
    float WeakPointMultiplier = 2.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Damage", meta = (ClampMin = "0.0"))
    float BodyMultiplier = 1.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Damage", meta = (ClampMin = "0.0"))
    float LimbMultiplier = 0.75f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon", meta = (ClampMin = "1.0"))
    float RoundsPerMinute = 300.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ammo", meta = (ClampMin = "1"))
    int32 MagazineCapacity = 12;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ammo", meta = (ClampMin = "0"))
    int32 ReserveAmmo = 48;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Ammo", meta = (ClampMin = "0.0"))
    float ReloadSeconds = 1.5f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Trace", meta = (ClampMin = "1.0"))
    float MaxRange = 10000.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Damage", meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float RangeFalloff = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Trace", meta = (ClampMin = "0.0"))
    float AimSpreadDegrees = 0.5f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AI", meta = (ClampMin = "0.0"))
    float AIPreferredRange = 2500.0f;
};

UCLASS(BlueprintType)
class FPS_API UFPSWeaponDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Weapon")
    FFPSWeaponData WeaponData;
};
