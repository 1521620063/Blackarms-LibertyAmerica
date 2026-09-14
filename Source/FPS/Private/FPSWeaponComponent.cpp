#include "FPSWeaponComponent.h"

#include "DrawDebugHelpers.h"
#include "FPSCharacterBase.h"
#include "FPSDamageResolver.h"
#include "FPSHealthComponent.h"
#include "FPSHitFeedbackComponent.h"
#include "FPSWeaponBase.h"
#include "Engine/World.h"
#include "TimerManager.h"

UFPSWeaponComponent::UFPSWeaponComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

bool UFPSWeaponComponent::EquipWeapon(TSubclassOf<AFPSWeaponBase> WeaponClass, UFPSWeaponDataAsset* DataAsset, int32 Slot)
{
    if (!GetWorld() || !WeaponClass || !DataAsset || Slot < 0)
    {
        return false;
    }
    Slots.SetNum(FMath::Max(Slots.Num(), Slot + 1));
    FWeaponSlotState& State = Slots[Slot];
    if (State.Weapon)
    {
        State.Weapon->Destroy();
    }
    FActorSpawnParameters Params;
    Params.Owner = GetOwner();
    Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
    State.Weapon = GetWorld()->SpawnActor<AFPSWeaponBase>(WeaponClass, Params);
    if (!State.Weapon)
    {
        return false;
    }
    State.Weapon->WeaponDataAsset = DataAsset;
    State.DataAsset = DataAsset;
    State.MagazineAmmo = FMath::Max(0, DataAsset->WeaponData.MagazineCapacity);
    State.ReserveAmmo = FMath::Max(0, DataAsset->WeaponData.ReserveAmmo);
    State.Weapon->AttachToActor(GetOwner(), FAttachmentTransformRules::KeepRelativeTransform);
    State.Weapon->SetActorHiddenInGame(true);
    if (CurrentSlot == INDEX_NONE)
    {
        CurrentSlot = Slot;
    }
    OnAmmoChanged.Broadcast();
    return true;
}

bool UFPSWeaponComponent::CanFire() const
{
    const FWeaponSlotState* State = CurrentState();
    const AFPSCharacterBase* Character = Cast<AFPSCharacterBase>(GetOwner());
    return State && State->DataAsset && State->MagazineAmmo > 0 && !bIsReloading
        && (!Character || Character->GetIsAlive())
        && GetWorld() && GetWorld()->GetTimeSeconds() >= NextFireTime;
}

bool UFPSWeaponComponent::FireWeapon(FVector TraceStart, FVector AimDirection)
{
    FWeaponSlotState* State = CurrentState();
    if (!State || !CanFire() || AimDirection.IsNearlyZero())
    {
        return false;
    }
    const FFPSWeaponData& Data = State->DataAsset->WeaponData;
    --State->MagazineAmmo;
    NextFireTime = GetWorld()->GetTimeSeconds() + 60.0 / FMath::Max(1.0f, Data.RoundsPerMinute);

    const FVector Direction = AimDirection.GetSafeNormal();
    if (Data.WeaponType == EFPS_WeaponType::ScatterGun)
    {
        static const FVector2D Pattern[] = {
            {0.0f, 0.0f}, {-0.7f, 0.2f}, {0.7f, -0.2f}, {-0.35f, -0.65f},
            {0.35f, 0.65f}, {-0.9f, -0.55f}, {0.9f, 0.55f}, {0.0f, 0.9f}
        };
        for (const FVector2D& Offset : Pattern)
        {
            TraceShot(TraceStart, ApplySpread(Direction, Offset.X * Data.AimSpreadDegrees, Offset.Y * Data.AimSpreadDegrees), Data, 1.0f / UE_ARRAY_COUNT(Pattern));
        }
    }
    else
    {
        TraceShot(TraceStart, Direction, Data);
    }

    OnAmmoChanged.Broadcast();
    OnWeaponFired.Broadcast(TraceStart, TraceStart + Direction * Data.MaxRange);
    return true;
}

bool UFPSWeaponComponent::ReloadWeapon()
{
    FWeaponSlotState* State = CurrentState();
    if (!State || !State->DataAsset || bIsReloading || State->ReserveAmmo <= 0
        || State->MagazineAmmo >= State->DataAsset->WeaponData.MagazineCapacity)
    {
        return false;
    }
    const AFPSCharacterBase* Character = Cast<AFPSCharacterBase>(GetOwner());
    if (Character && !Character->GetIsAlive())
    {
        return false;
    }
    bIsReloading = true;
    OnReloadStarted.Broadcast();
    GetWorld()->GetTimerManager().SetTimer(ReloadTimer, this, &UFPSWeaponComponent::CompleteReload, FMath::Max(0.01f, State->DataAsset->WeaponData.ReloadSeconds), false);
    return true;
}

bool UFPSWeaponComponent::SwitchWeapon(int32 Slot)
{
    if (!Slots.IsValidIndex(Slot) || !Slots[Slot].DataAsset || Slot == CurrentSlot)
    {
        return false;
    }
    GetWorld()->GetTimerManager().ClearTimer(ReloadTimer);
    bIsReloading = false;
    CurrentSlot = Slot;
    NextFireTime = 0.0;
    OnAmmoChanged.Broadcast();
    return true;
}

int32 UFPSWeaponComponent::GetCurrentAmmo() const
{
    const FWeaponSlotState* State = CurrentState();
    return State ? State->MagazineAmmo : 0;
}

int32 UFPSWeaponComponent::GetReserveAmmo() const
{
    const FWeaponSlotState* State = CurrentState();
    return State ? State->ReserveAmmo : 0;
}

bool UFPSWeaponComponent::GetCurrentWeaponData(FFPSWeaponData& OutData) const
{
    const FWeaponSlotState* State = CurrentState();
    if (!State || !State->DataAsset)
    {
        return false;
    }
    OutData = State->DataAsset->WeaponData;
    return true;
}

void UFPSWeaponComponent::ResetWeapons()
{
    GetWorld()->GetTimerManager().ClearTimer(ReloadTimer);
    bIsReloading = false;
    NextFireTime = 0.0;
    for (FWeaponSlotState& State : Slots)
    {
        if (State.DataAsset)
        {
            State.MagazineAmmo = State.DataAsset->WeaponData.MagazineCapacity;
            State.ReserveAmmo = State.DataAsset->WeaponData.ReserveAmmo;
        }
    }
    OnAmmoChanged.Broadcast();
}

UFPSWeaponComponent::FWeaponSlotState* UFPSWeaponComponent::CurrentState()
{
    return Slots.IsValidIndex(CurrentSlot) ? &Slots[CurrentSlot] : nullptr;
}

const UFPSWeaponComponent::FWeaponSlotState* UFPSWeaponComponent::CurrentState() const
{
    return Slots.IsValidIndex(CurrentSlot) ? &Slots[CurrentSlot] : nullptr;
}

void UFPSWeaponComponent::CompleteReload()
{
    FWeaponSlotState* State = CurrentState();
    if (!State || !State->DataAsset)
    {
        bIsReloading = false;
        return;
    }
    const int32 Needed = State->DataAsset->WeaponData.MagazineCapacity - State->MagazineAmmo;
    const int32 Loaded = FMath::Min(Needed, State->ReserveAmmo);
    State->MagazineAmmo += Loaded;
    State->ReserveAmmo -= Loaded;
    bIsReloading = false;
    OnAmmoChanged.Broadcast();
    OnReloadCompleted.Broadcast();
}

bool UFPSWeaponComponent::TraceShot(const FVector& Start, const FVector& Direction, const FFPSWeaponData& Data, float DamageScale)
{
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(FPSWeaponTrace), true, GetOwner());
    const FVector End = Start + Direction * Data.MaxRange;
    const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
    DrawDebugLine(GetWorld(), Start, bHit ? Hit.ImpactPoint : End, bHit ? FColor::Green : FColor::Red, false, 0.5f, 0, 1.0f);
    if (!bHit || !Hit.GetActor())
    {
        return false;
    }
    FFPSWeaponData ScaledData = Data;
    ScaledData.BaseDamage *= DamageScale;
    float AppliedDamage = 0.0f;
    bool bKilled = false;
    const FName Zone = Hit.BoneName.IsNone() ? FName(TEXT("Body")) : Hit.BoneName;
    if (!AFPSDamageResolver::ResolveDamage(Hit.GetActor(), ScaledData, Zone, Hit.Distance, GetOwner(), AppliedDamage, bKilled))
    {
        return false;
    }
    if (const AFPSCharacterBase* Character = Cast<AFPSCharacterBase>(GetOwner()))
    {
        if (Character->HitFeedbackComponent)
        {
            Character->HitFeedbackComponent->ReportHit(AppliedDamage, bKilled);
        }
    }
    return true;
}

FVector UFPSWeaponComponent::ApplySpread(const FVector& Direction, float YawDegrees, float PitchDegrees)
{
    const FRotator Rotation = Direction.Rotation() + FRotator(PitchDegrees, YawDegrees, 0.0f);
    return Rotation.Vector();
}
