#pragma once

#include "Components/ActorComponent.h"
#include "BLAHealthComponent.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FBLAHealthChangedSignature, float, CurrentHealth, float, Delta);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FBLADeathSignature, AActor*, InstigatorActor);
DECLARE_MULTICAST_DELEGATE_OneParam(FBLADeathNativeSignature, AActor*);
DECLARE_MULTICAST_DELEGATE_TwoParams(FBLACombatantDeathNativeSignature, AActor*, AActor*);

UCLASS(Blueprintable, ClassGroup = "BLA", meta = (BlueprintSpawnableComponent))
class BLA_API UBLAHealthComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UBLAHealthComponent();

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Health", meta = (ClampMin = "1.0"))
    float MaxHealth = 100.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Replicated, Category = "Health")
    float CurrentHealth = 100.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Health", meta = (ClampMin = "0.0"))
    float ArmorValue = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Replicated, Category = "Health")
    bool bIsDead = false;

    UPROPERTY(BlueprintAssignable, Category = "Health")
    FBLAHealthChangedSignature OnHealthChanged;

    UPROPERTY(BlueprintAssignable, Category = "Health")
    FBLADeathSignature OnDeath;

    FBLADeathNativeSignature OnDeathNative;
    FBLACombatantDeathNativeSignature OnCombatantDeathNative;

    UFUNCTION(BlueprintCallable, Category = "Health")
    bool ApplyDamage(float Amount, FName DamageLocation, AActor* InstigatorActor);

    UFUNCTION(BlueprintCallable, Category = "Health")
    void ResetHealth();

    UFUNCTION(BlueprintCallable, Category = "Health")
    void HandleDeath(AActor* InstigatorActor = nullptr);

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
