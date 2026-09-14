#include "BLAWeaponComponent.h"

#include "DrawDebugHelpers.h"
#include "BLACharacterBase.h"
#include "BLADamageResolver.h"
#include "BLAHealthComponent.h"
#include "BLAHitFeedbackComponent.h"
#include "BLAWeaponBase.h"
#include "Engine/World.h"
#include "TimerManager.h"

UBLAWeaponComponent::UBLAWeaponComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

bool UBLAWeaponComponent::EquipWeapon(TSubclassOf<ABLAWeaponBase> WeaponClass, UBLAWeaponDataAsset* DataAsset, int32 Slot)
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
    State.Weapon = GetWorld()->SpawnActor<ABLAWeaponBase>(WeaponClass, Params);
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

bool UBLAWeaponComponent::CanFire() const
{
    const FWeaponSlotState* State = CurrentState();
    const ABLACharacterBase* Character = Cast<ABLACharacterBase>(GetOwner());
    return State && State->DataAsset && State->MagazineAmmo > 0 && !bIsReloading
        && (!Character || Character->GetIsAlive())
        && GetWorld() && GetWorld()->GetTimeSeconds() >= NextFireTime;
}

bool UBLAWeaponComponent::FireWeapon(FVector TraceStart, FVector AimDirection)
{
    FWeaponSlotState* State = CurrentState();
    if (!State || !CanFire() || AimDirection.IsNearlyZero())
    {
        return false;
    }
    const FBLAWeaponData& Data = State->DataAsset->WeaponData;
    --State->MagazineAmmo;
    NextFireTime = GetWorld()->GetTimeSeconds() + 60.0 / FMath::Max(1.0f, Data.RoundsPerMinute);

    const FVector Direction = AimDirection.GetSafeNormal();
    if (Data.WeaponType == EBLA_WeaponType::ScatterGun)
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

bool UBLAWeaponComponent::ReloadWeapon()
{
    FWeaponSlotState* State = CurrentState();
    if (!State || !State->DataAsset || bIsReloading || State->ReserveAmmo <= 0
        || State->MagazineAmmo >= State->DataAsset->WeaponData.MagazineCapacity)
    {
        return false;
    }
    const ABLACharacterBase* Character = Cast<ABLACharacterBase>(GetOwner());
    if (Character && !Character->GetIsAlive())
    {
        return false;
    }
    bIsReloading = true;
    OnReloadStarted.Broadcast();
    GetWorld()->GetTimerManager().SetTimer(ReloadTimer, this, &UBLAWeaponComponent::CompleteReload, FMath::Max(0.01f, State->DataAsset->WeaponData.ReloadSeconds), false);
    return true;
}

bool UBLAWeaponComponent::SwitchWeapon(int32 Slot)
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

int32 UBLAWeaponComponent::GetCurrentAmmo() const
{
    const FWeaponSlotState* State = CurrentState();
    return State ? State->MagazineAmmo : 0;
}

int32 UBLAWeaponComponent::GetReserveAmmo() const
{
    const FWeaponSlotState* State = CurrentState();
    return State ? State->ReserveAmmo : 0;
}

bool UBLAWeaponComponent::GetCurrentWeaponData(FBLAWeaponData& OutData) const
{
    const FWeaponSlotState* State = CurrentState();
    if (!State || !State->DataAsset)
    {
        return false;
    }
    OutData = State->DataAsset->WeaponData;
    return true;
}

void UBLAWeaponComponent::ResetWeapons()
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

UBLAWeaponComponent::FWeaponSlotState* UBLAWeaponComponent::CurrentState()
{
    return Slots.IsValidIndex(CurrentSlot) ? &Slots[CurrentSlot] : nullptr;
}

const UBLAWeaponComponent::FWeaponSlotState* UBLAWeaponComponent::CurrentState() const
{
    return Slots.IsValidIndex(CurrentSlot) ? &Slots[CurrentSlot] : nullptr;
}

void UBLAWeaponComponent::CompleteReload()
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

bool UBLAWeaponComponent::TraceShot(const FVector& Start, const FVector& Direction, const FBLAWeaponData& Data, float DamageScale)
{
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(BLAWeaponTrace), true, GetOwner());
    const FVector End = Start + Direction * Data.MaxRange;
    const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit, Start, End, ECC_Visibility, Params);
    DrawDebugLine(GetWorld(), Start, bHit ? Hit.ImpactPoint : End, bHit ? FColor::Green : FColor::Red, false, 0.5f, 0, 1.0f);
    if (!bHit || !Hit.GetActor())
    {
        return false;
    }
    FBLAWeaponData ScaledData = Data;
    ScaledData.BaseDamage *= DamageScale;
    float AppliedDamage = 0.0f;
    bool bKilled = false;
    const FName Zone = Hit.BoneName.IsNone() ? FName(TEXT("Body")) : Hit.BoneName;
    if (!ABLADamageResolver::ResolveDamage(Hit.GetActor(), ScaledData, Zone, Hit.Distance, GetOwner(), AppliedDamage, bKilled))
    {
        return false;
    }
    if (const ABLACharacterBase* Character = Cast<ABLACharacterBase>(GetOwner()))
    {
        if (Character->HitFeedbackComponent)
        {
            Character->HitFeedbackComponent->ReportHit(AppliedDamage, bKilled);
        }
    }
    return true;
}

FVector UBLAWeaponComponent::ApplySpread(const FVector& Direction, float YawDegrees, float PitchDegrees)
{
    const FRotator Rotation = Direction.Rotation() + FRotator(PitchDegrees, YawDegrees, 0.0f);
    return Rotation.Vector();
}
