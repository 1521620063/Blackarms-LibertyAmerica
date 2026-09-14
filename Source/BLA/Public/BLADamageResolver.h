#pragma once

#include "BLAWeaponTypes.h"
#include "GameFramework/Actor.h"
#include "BLADamageResolver.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLADamageResolver : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintPure, Category = "BLA|Damage")
    static float CalculateFinalDamage(const FBLAWeaponData& WeaponData, FName DamageLocation, float Distance, float ArmorValue);

    UFUNCTION(BlueprintCallable, Category = "BLA|Damage")
    static bool ResolveDamage(AActor* TargetActor, const FBLAWeaponData& WeaponData, FName DamageLocation, float Distance, AActor* InstigatorActor, float& AppliedDamage, bool& bKilled);
};
