#include "BLADamageResolver.h"

#include "BLACharacterBase.h"
#include "BLAHealthComponent.h"

namespace
{
    float LocationMultiplier(const FBLAWeaponData& Data, FName Location)
    {
        const FString Name = Location.ToString();
        if (Name.Contains(TEXT("Weak"), ESearchCase::IgnoreCase)
            || Name.Contains(TEXT("Head"), ESearchCase::IgnoreCase)
            || Name.Contains(TEXT("Core"), ESearchCase::IgnoreCase))
        {
            return Data.WeakPointMultiplier;
        }
        if (Name.Contains(TEXT("Limb"), ESearchCase::IgnoreCase)
            || Name.Contains(TEXT("Arm"), ESearchCase::IgnoreCase)
            || Name.Contains(TEXT("Leg"), ESearchCase::IgnoreCase))
        {
            return Data.LimbMultiplier;
        }
        return Data.BodyMultiplier;
    }
}

float ABLADamageResolver::CalculateFinalDamage(const FBLAWeaponData& WeaponData, FName DamageLocation, float Distance, float ArmorValue)
{
    const float RangeAlpha = FMath::Clamp(Distance / FMath::Max(1.0f, WeaponData.MaxRange), 0.0f, 1.0f);
    const float RangeMultiplier = FMath::Lerp(1.0f, FMath::Clamp(WeaponData.RangeFalloff, 0.0f, 1.0f), RangeAlpha);
    const float ArmorMultiplier = FMath::Clamp(1.0f - FMath::Max(0.0f, ArmorValue) / 100.0f, 0.25f, 1.0f);
    return FMath::Max(0.0f, WeaponData.BaseDamage * LocationMultiplier(WeaponData, DamageLocation) * RangeMultiplier * ArmorMultiplier);
}

bool ABLADamageResolver::ResolveDamage(AActor* TargetActor, const FBLAWeaponData& WeaponData, FName DamageLocation, float Distance, AActor* InstigatorActor, float& AppliedDamage, bool& bKilled)
{
    AppliedDamage = 0.0f;
    bKilled = false;
    ABLACharacterBase* Target = Cast<ABLACharacterBase>(TargetActor);
    if (!Target || !Target->HealthComponent || Target->HealthComponent->bIsDead)
    {
        return false;
    }

    AppliedDamage = CalculateFinalDamage(WeaponData, DamageLocation, Distance, Target->HealthComponent->ArmorValue);
    if (!Target->ApplyCombatDamage(AppliedDamage, DamageLocation, InstigatorActor))
    {
        AppliedDamage = 0.0f;
        return false;
    }
    bKilled = Target->HealthComponent->bIsDead;
    return true;
}
