#include "FPSWeaponTestActor.h"

#include "FPSCharacterBase.h"
#include "FPSDamageResolver.h"
#include "FPSHealthComponent.h"
#include "FPSHitFeedbackComponent.h"
#include "FPSWeaponBase.h"
#include "FPSWeaponComponent.h"
#include "FPSWeaponTypes.h"

AFPSWeaponTestActor::AFPSWeaponTestActor()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AFPSWeaponTestActor::BeginPlay()
{
    Super::BeginPlay();

    const FVector Base = GetActorLocation() + FVector(0.0f, 0.0f, 500.0f);
    Shooter = GetWorld()->SpawnActor<AFPSPlayerCharacter>(AFPSPlayerCharacter::StaticClass(), Base + FVector(-250.0f, 0.0f, 0.0f), FRotator::ZeroRotator);
    Target = GetWorld()->SpawnActor<AFPSPlayerCharacter>(AFPSPlayerCharacter::StaticClass(), Base + FVector(250.0f, 0.0f, 0.0f), FRotator(0.0f, 180.0f, 0.0f));
    if (!Shooter || !Target)
    {
        Fail(TEXT("spawn"));
        return;
    }

    PrimaryData = NewObject<UFPSWeaponDataAsset>(this);
    PrimaryData->WeaponData.WeaponType = EFPS_WeaponType::PulseRifle;
    PrimaryData->WeaponData.BaseDamage = 20.0f;
    PrimaryData->WeaponData.RoundsPerMinute = 600.0f;
    PrimaryData->WeaponData.MagazineCapacity = 2;
    PrimaryData->WeaponData.ReserveAmmo = 3;
    PrimaryData->WeaponData.ReloadSeconds = 0.1f;
    PrimaryData->WeaponData.MaxRange = 2000.0f;
    PrimaryData->WeaponData.RangeFalloff = 1.0f;

    SecondaryData = NewObject<UFPSWeaponDataAsset>(this);
    SecondaryData->WeaponData.WeaponType = EFPS_WeaponType::ScatterGun;
    SecondaryData->WeaponData.BaseDamage = 80.0f;
    SecondaryData->WeaponData.MagazineCapacity = 6;
    SecondaryData->WeaponData.ReserveAmmo = 12;
    SecondaryData->WeaponData.MaxRange = 2000.0f;
    SecondaryData->WeaponData.RangeFalloff = 1.0f;
    SecondaryData->WeaponData.AimSpreadDegrees = 1.0f;

    TertiaryData = NewObject<UFPSWeaponDataAsset>(this);
    TertiaryData->WeaponData.WeaponType = EFPS_WeaponType::EnergyPistol;
    TertiaryData->WeaponData.BaseDamage = 25.0f;
    TertiaryData->WeaponData.MagazineCapacity = 12;
    TertiaryData->WeaponData.ReserveAmmo = 24;
    TertiaryData->WeaponData.MaxRange = 2000.0f;
    TertiaryData->WeaponData.RangeFalloff = 1.0f;

    if (!Shooter->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), PrimaryData, 0)
        || !Shooter->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), SecondaryData, 1)
        || !Shooter->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), TertiaryData, 2))
    {
        Fail(TEXT("equip"));
        return;
    }
    Shooter->HitFeedbackComponent->OnHitConfirmed.AddUniqueDynamic(this, &AFPSWeaponTestActor::HandleHitFeedback);

    FFPSWeaponData CalculationData = PrimaryData->WeaponData;
    CalculationData.RangeFalloff = 0.5f;
    CalculationData.MaxRange = 1000.0f;
    if (!FMath::IsNearlyEqual(AFPSDamageResolver::CalculateFinalDamage(CalculationData, TEXT("Body"), 0.0f, 0.0f), 20.0f)
        || !FMath::IsNearlyEqual(AFPSDamageResolver::CalculateFinalDamage(CalculationData, TEXT("WeakPoint"), 0.0f, 0.0f), 40.0f)
        || !FMath::IsNearlyEqual(AFPSDamageResolver::CalculateFinalDamage(CalculationData, TEXT("Limb"), 0.0f, 0.0f), 15.0f)
        || !FMath::IsNearlyEqual(AFPSDamageResolver::CalculateFinalDamage(CalculationData, TEXT("Body"), 1000.0f, 0.0f), 10.0f)
        || !FMath::IsNearlyEqual(AFPSDamageResolver::CalculateFinalDamage(CalculationData, TEXT("Body"), 0.0f, 25.0f), 15.0f))
    {
        Fail(TEXT("damage_formula"));
        return;
    }

    const FVector Start = Shooter->GetActorLocation() + FVector(0.0f, 0.0f, 45.0f);
    const FVector Direction = (Target->GetActorLocation() + FVector(0.0f, 0.0f, 45.0f) - Start).GetSafeNormal();
    const bool bFirstFire = Shooter->WeaponComponent->FireWeapon(Start, Direction);
    const float TargetHealth = Target->HealthComponent->CurrentHealth;
    const int32 CurrentAmmo = Shooter->WeaponComponent->GetCurrentAmmo();
    const bool bCooldownFire = Shooter->WeaponComponent->FireWeapon(Start, Direction);
    if (!bFirstFire
        || !FMath::IsNearlyEqual(TargetHealth, 80.0f)
        || CurrentAmmo != 1
        || bCooldownFire)
    {
        Fail(TEXT("fire_cooldown"));
    }
}

void AFPSWeaponTestActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bFinished || !Shooter || !Target)
    {
        return;
    }

    ElapsedSeconds += DeltaSeconds;
    const FVector Start = Shooter->GetActorLocation() + FVector(0.0f, 0.0f, 45.0f);
    const FVector Direction = (Target->GetActorLocation() + FVector(0.0f, 0.0f, 45.0f) - Start).GetSafeNormal();
    if (Stage == 0 && ElapsedSeconds >= 0.12f)
    {
        if (!Shooter->WeaponComponent->FireWeapon(Start, Direction)
            || Shooter->WeaponComponent->GetCurrentAmmo() != 0
            || Shooter->WeaponComponent->FireWeapon(Start, Direction)
            || !Shooter->WeaponComponent->ReloadWeapon()
            || !Shooter->WeaponComponent->IsReloading()
            || Shooter->WeaponComponent->FireWeapon(Start, Direction))
        {
            Fail(TEXT("empty_reload_guard"));
            return;
        }
        Stage = 1;
        ElapsedSeconds = 0.0f;
    }
    else if (Stage == 1 && ElapsedSeconds >= 0.15f)
    {
        if (Shooter->WeaponComponent->IsReloading() && ElapsedSeconds < 1.0f)
        {
            return;
        }
        const bool bReloading = Shooter->WeaponComponent->IsReloading();
        const int32 ReloadedAmmo = Shooter->WeaponComponent->GetCurrentAmmo();
        const int32 ReloadedReserve = Shooter->WeaponComponent->GetReserveAmmo();
        const bool bSwitchedPistol = Shooter->WeaponComponent->SwitchWeapon(2);
        Target->ResetCombatant();
        const bool bPistolFired = Shooter->WeaponComponent->FireWeapon(Start, Direction);
        const float PistolTargetHealth = Target->HealthComponent->CurrentHealth;
        const int32 PistolAmmo = Shooter->WeaponComponent->GetCurrentAmmo();
        const bool bSwitchedSecondary = Shooter->WeaponComponent->SwitchWeapon(1);
        Target->ResetCombatant();
        const bool bScatterFired = Shooter->WeaponComponent->FireWeapon(Start, Direction);
        const float ScatterTargetHealth = Target->HealthComponent->CurrentHealth;
        const int32 SecondaryAmmo = Shooter->WeaponComponent->GetCurrentAmmo();
        const bool bSwitchedPrimary = Shooter->WeaponComponent->SwitchWeapon(0);
        if (bReloading
            || ReloadedAmmo != 2
            || ReloadedReserve != 1
            || !bSwitchedPistol
            || !bPistolFired
            || !FMath::IsNearlyEqual(PistolTargetHealth, 75.0f)
            || PistolAmmo != 11
            || !bSwitchedSecondary
            || !bScatterFired
            || !FMath::IsNearlyEqual(ScatterTargetHealth, 20.0f, 0.2f)
            || SecondaryAmmo != 5
            || !bSwitchedPrimary)
        {
            Fail(TEXT("reload_switch"));
            return;
        }

        Target->ResetCombatant();
        Target->HealthComponent->ArmorValue = 25.0f;
        float AppliedDamage = 0.0f;
        bool bKilled = false;
        if (!AFPSDamageResolver::ResolveDamage(Target, PrimaryData->WeaponData, TEXT("Body"), 0.0f, Shooter, AppliedDamage, bKilled)
            || !FMath::IsNearlyEqual(AppliedDamage, 15.0f)
            || !FMath::IsNearlyEqual(Target->HealthComponent->CurrentHealth, 85.0f)
            || bKilled)
        {
            Fail(TEXT("armor_resolution"));
            return;
        }

        Target->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Shooter);
        if (AFPSDamageResolver::ResolveDamage(Target, PrimaryData->WeaponData, TEXT("Body"), 0.0f, Shooter, AppliedDamage, bKilled))
        {
            Fail(TEXT("target_death_guard"));
            return;
        }
        Shooter->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Target);
        if (Shooter->WeaponComponent->CanFire() || Shooter->WeaponComponent->FireWeapon(Start, Direction))
        {
            Fail(TEXT("shooter_death_guard"));
            return;
        }
        if (FeedbackCount != 11)
        {
            Fail(TEXT("hit_feedback"));
            return;
        }

        UE_LOG(LogTemp, Display, TEXT("FPS_WEAPON_SYSTEM_OK weapons=3 ammo=guarded reload=complete switch=ok damage=zones_falloff_armor death=guarded feedback=hit"));
        bFinished = true;
        SetActorTickEnabled(false);
    }
}

void AFPSWeaponTestActor::HandleHitFeedback(float AppliedDamage, bool bKilled)
{
    ++FeedbackCount;
}

void AFPSWeaponTestActor::Fail(const TCHAR* Reason)
{
    UE_LOG(LogTemp, Error, TEXT("FPS_WEAPON_SYSTEM_FAILED reason=%s"), Reason);
    bFinished = true;
    SetActorTickEnabled(false);
}
