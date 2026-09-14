#pragma once

#include "FPSWeaponTypes.h"
#include "GameFramework/Actor.h"
#include "FPSDamageResolver.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPSDamageResolver : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintPure, Category = "FPS|Damage")
    static float CalculateFinalDamage(const FFPSWeaponData& WeaponData, FName DamageLocation, float Distance, float ArmorValue);

    UFUNCTION(BlueprintCallable, Category = "FPS|Damage")
    static bool ResolveDamage(AActor* TargetActor, const FFPSWeaponData& WeaponData, FName DamageLocation, float Distance, AActor* InstigatorActor, float& AppliedDamage, bool& bKilled);
};
