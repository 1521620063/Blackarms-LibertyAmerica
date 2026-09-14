#pragma once

#include "Components/ActorComponent.h"
#include "FPSWeaponTypes.h"
#include "TimerManager.h"
#include "FPSWeaponComponent.generated.h"

class AFPSWeaponBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FFPSWeaponStateSignature);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FFPSWeaponFiredSignature, FVector, TraceStart, FVector, TraceEnd);

UCLASS(Blueprintable, ClassGroup = "FPS", meta = (BlueprintSpawnableComponent))
class FPS_API UFPSWeaponComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFPSWeaponComponent();

    UPROPERTY(BlueprintAssignable, Category = "FPS|Weapon")
    FFPSWeaponStateSignature OnAmmoChanged;

    UPROPERTY(BlueprintAssignable, Category = "FPS|Weapon")
    FFPSWeaponStateSignature OnReloadStarted;

    UPROPERTY(BlueprintAssignable, Category = "FPS|Weapon")
    FFPSWeaponStateSignature OnReloadCompleted;

    UPROPERTY(BlueprintAssignable, Category = "FPS|Weapon")
    FFPSWeaponFiredSignature OnWeaponFired;

    UFUNCTION(BlueprintCallable, Category = "FPS|Weapon")
    bool EquipWeapon(TSubclassOf<AFPSWeaponBase> WeaponClass, UFPSWeaponDataAsset* DataAsset, int32 Slot);

    UFUNCTION(BlueprintCallable, Category = "FPS|Weapon")
    bool FireWeapon(FVector TraceStart, FVector AimDirection);

    UFUNCTION(BlueprintCallable, Category = "FPS|Weapon")
    bool ReloadWeapon();

    UFUNCTION(BlueprintCallable, Category = "FPS|Weapon")
    bool SwitchWeapon(int32 Slot);

    UFUNCTION(BlueprintPure, Category = "FPS|Weapon")
    int32 GetCurrentAmmo() const;

    UFUNCTION(BlueprintPure, Category = "FPS|Weapon")
    int32 GetReserveAmmo() const;

    UFUNCTION(BlueprintPure, Category = "FPS|Weapon")
    bool CanFire() const;

    UFUNCTION(BlueprintPure, Category = "FPS|Weapon")
    bool IsReloading() const { return bIsReloading; }

    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void ResetWeapons();

private:
    struct FWeaponSlotState
    {
        TObjectPtr<AFPSWeaponBase> Weapon;
        TObjectPtr<UFPSWeaponDataAsset> DataAsset;
        int32 MagazineAmmo = 0;
        int32 ReserveAmmo = 0;
    };

    FWeaponSlotState* CurrentState();
    const FWeaponSlotState* CurrentState() const;
    void CompleteReload();
    bool TraceShot(const FVector& Start, const FVector& Direction, const FFPSWeaponData& Data, float DamageScale = 1.0f);
    static FVector ApplySpread(const FVector& Direction, float YawDegrees, float PitchDegrees);

    TArray<FWeaponSlotState> Slots;
    int32 CurrentSlot = INDEX_NONE;
    double NextFireTime = 0.0;
    bool bIsReloading = false;
    FTimerHandle ReloadTimer;
};
