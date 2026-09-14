#pragma once

#include "Components/ActorComponent.h"
#include "FPSHealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FFPSHealthChangedSignature, float, CurrentHealth, float, Delta);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FFPSDeathSignature, AActor*, InstigatorActor);
DECLARE_MULTICAST_DELEGATE_OneParam(FFPSDeathNativeSignature, AActor*);
DECLARE_MULTICAST_DELEGATE_TwoParams(FFPSCombatantDeathNativeSignature, AActor*, AActor*);

UCLASS(Blueprintable, ClassGroup = "FPS", meta = (BlueprintSpawnableComponent))
class FPS_API UFPSHealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFPSHealthComponent();

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Health", meta = (ClampMin = "1.0"))
    float MaxHealth = 100.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Health")
    float CurrentHealth = 100.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Health", meta = (ClampMin = "0.0"))
    float ArmorValue = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Health")
    bool bIsDead = false;

    UPROPERTY(BlueprintAssignable, Category = "Health")
    FFPSHealthChangedSignature OnHealthChanged;

    UPROPERTY(BlueprintAssignable, Category = "Health")
    FFPSDeathSignature OnDeath;

    FFPSDeathNativeSignature OnDeathNative;
    FFPSCombatantDeathNativeSignature OnCombatantDeathNative;

    UFUNCTION(BlueprintCallable, Category = "Health")
    bool ApplyDamage(float Amount, FName DamageLocation, AActor* InstigatorActor);

    UFUNCTION(BlueprintCallable, Category = "Health")
    void ResetHealth();

    UFUNCTION(BlueprintCallable, Category = "Health")
    void HandleDeath(AActor* InstigatorActor = nullptr);
};
