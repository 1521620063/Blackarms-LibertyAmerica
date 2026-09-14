#pragma once

#include "Components/ActorComponent.h"
#include "BLAWeaponTypes.h"
#include "TimerManager.h"
#include "BLAWeaponComponent.generated.h"

class ABLAWeaponBase;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FBLAWeaponStateSignature);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FBLAWeaponFiredSignature, FVector, TraceStart, FVector, TraceEnd);

UCLASS(Blueprintable, ClassGroup = "BLA", meta = (BlueprintSpawnableComponent))
class BLA_API UBLAWeaponComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UBLAWeaponComponent();

    UPROPERTY(BlueprintAssignable, Category = "BLA|Weapon")
    FBLAWeaponStateSignature OnAmmoChanged;

    UPROPERTY(BlueprintAssignable, Category = "BLA|Weapon")
    FBLAWeaponStateSignature OnReloadStarted;

    UPROPERTY(BlueprintAssignable, Category = "BLA|Weapon")
    FBLAWeaponStateSignature OnReloadCompleted;

    UPROPERTY(BlueprintAssignable, Category = "BLA|Weapon")
    FBLAWeaponFiredSignature OnWeaponFired;

    UFUNCTION(BlueprintCallable, Category = "BLA|Weapon")
    bool EquipWeapon(TSubclassOf<ABLAWeaponBase> WeaponClass, UBLAWeaponDataAsset* DataAsset, int32 Slot);

    UFUNCTION(BlueprintCallable, Category = "BLA|Weapon")
    bool FireWeapon(FVector TraceStart, FVector AimDirection);

    UFUNCTION(BlueprintCallable, Category = "BLA|Weapon")
    bool ReloadWeapon();

    UFUNCTION(BlueprintCallable, Category = "BLA|Weapon")
    bool SwitchWeapon(int32 Slot);

    UFUNCTION(BlueprintPure, Category = "BLA|Weapon")
    int32 GetCurrentAmmo() const;

    UFUNCTION(BlueprintPure, Category = "BLA|Weapon")
    int32 GetReserveAmmo() const;

    UFUNCTION(BlueprintPure, Category = "BLA|Weapon")
    bool CanFire() const;

    UFUNCTION(BlueprintPure, Category = "BLA|Weapon")
    bool IsReloading() const { return bIsReloading; }

    UFUNCTION(BlueprintPure, Category = "BLA|Weapon")
    bool GetCurrentWeaponData(FBLAWeaponData& OutData) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void ResetWeapons();

private:
    struct FWeaponSlotState
    {
        TObjectPtr<ABLAWeaponBase> Weapon;
        TObjectPtr<UBLAWeaponDataAsset> DataAsset;
        int32 MagazineAmmo = 0;
        int32 ReserveAmmo = 0;
    };

    FWeaponSlotState* CurrentState();
    const FWeaponSlotState* CurrentState() const;
    void CompleteReload();
    bool TraceShot(const FVector& Start, const FVector& Direction, const FBLAWeaponData& Data, float DamageScale = 1.0f);
    static FVector ApplySpread(const FVector& Direction, float YawDegrees, float PitchDegrees);

    TArray<FWeaponSlotState> Slots;
    int32 CurrentSlot = INDEX_NONE;
    double NextFireTime = 0.0;
    bool bIsReloading = false;
    FTimerHandle ReloadTimer;
};
