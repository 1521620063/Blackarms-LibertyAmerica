#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Character.h"
#include "FPSCharacterBase.generated.h"

class UCameraComponent;
class UFPSHealthComponent;
class UFPSHitFeedbackComponent;
class UFPSInteractionComponent;
class UFPSWeaponComponent;

UCLASS(Blueprintable)
class FPS_API AFPSCharacterBase : public ACharacter
{
    GENERATED_BODY()

public:
    AFPSCharacterBase();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS")
    TObjectPtr<UCameraComponent> FirstPersonCamera;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS")
    TObjectPtr<UFPSHealthComponent> HealthComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS")
    TObjectPtr<UFPSInteractionComponent> InteractionComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS")
    TObjectPtr<UFPSWeaponComponent> WeaponComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS")
    TObjectPtr<UFPSHitFeedbackComponent> HitFeedbackComponent;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS")
    EFPS_Team Team = EFPS_Team::Neutral;

    UFUNCTION(BlueprintNativeEvent, BlueprintPure, Category = "FPS|Combatant")
    EFPS_Team GetTeam() const;
    virtual EFPS_Team GetTeam_Implementation() const;

    UFUNCTION(BlueprintNativeEvent, BlueprintPure, Category = "FPS|Combatant")
    bool GetIsAlive() const;
    virtual bool GetIsAlive_Implementation() const;

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "FPS|Combatant")
    bool ApplyCombatDamage(float DamageAmount, FName DamageLocation, AActor* InstigatorActor);
    virtual bool ApplyCombatDamage_Implementation(float DamageAmount, FName DamageLocation, AActor* InstigatorActor);

    UFUNCTION(BlueprintNativeEvent, BlueprintPure, Category = "FPS|Combatant")
    FVector GetCombatantWorldLocation() const;
    virtual FVector GetCombatantWorldLocation_Implementation() const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void ResetCombatant();

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void HandleHealthDeath(AActor* InstigatorActor);
};

UCLASS(Blueprintable)
class FPS_API AFPSPlayerCharacter : public AFPSCharacterBase
{
    GENERATED_BODY()
};

UCLASS(Blueprintable)
class FPS_API AFPSBotCharacter : public AFPSCharacterBase
{
    GENERATED_BODY()
};
