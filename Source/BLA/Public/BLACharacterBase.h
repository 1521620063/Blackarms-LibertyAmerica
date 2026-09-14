#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Character.h"
#include "GenericTeamAgentInterface.h"
#include "BLACharacterBase.generated.h"

class UCameraComponent;
class UAIPerceptionStimuliSourceComponent;
class UBLAHealthComponent;
class UBLAHitFeedbackComponent;
class UBLAInteractionComponent;
class UBLAWeaponComponent;

UCLASS(Blueprintable)
class BLA_API ABLACharacterBase : public ACharacter, public IGenericTeamAgentInterface
{
    GENERATED_BODY()

public:
    ABLACharacterBase();

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA")
    TObjectPtr<UCameraComponent> FirstPersonCamera;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA")
    TObjectPtr<UBLAHealthComponent> HealthComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA")
    TObjectPtr<UBLAInteractionComponent> InteractionComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA")
    TObjectPtr<UBLAWeaponComponent> WeaponComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA")
    TObjectPtr<UBLAHitFeedbackComponent> HitFeedbackComponent;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA")
    TObjectPtr<UAIPerceptionStimuliSourceComponent> PerceptionSource;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA")
    EBLA_Team Team = EBLA_Team::Neutral;

    UFUNCTION(BlueprintNativeEvent, BlueprintPure, Category = "BLA|Combatant")
    EBLA_Team GetTeam() const;
    virtual EBLA_Team GetTeam_Implementation() const;

    UFUNCTION(BlueprintNativeEvent, BlueprintPure, Category = "BLA|Combatant")
    bool GetIsAlive() const;
    virtual bool GetIsAlive_Implementation() const;

    UFUNCTION(BlueprintNativeEvent, BlueprintCallable, Category = "BLA|Combatant")
    bool ApplyCombatDamage(float DamageAmount, FName DamageLocation, AActor* InstigatorActor);
    virtual bool ApplyCombatDamage_Implementation(float DamageAmount, FName DamageLocation, AActor* InstigatorActor);

    UFUNCTION(BlueprintNativeEvent, BlueprintPure, Category = "BLA|Combatant")
    FVector GetCombatantWorldLocation() const;
    virtual FVector GetCombatantWorldLocation_Implementation() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void ResetCombatant();

    virtual FGenericTeamId GetGenericTeamId() const override;
    virtual ETeamAttitude::Type GetTeamAttitudeTowards(const AActor& Other) const override;

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void HandleHealthDeath(AActor* InstigatorActor);
};

UCLASS(Blueprintable)
class BLA_API ABLAPlayerCharacter : public ABLACharacterBase
{
    GENERATED_BODY()
};

UCLASS(Blueprintable)
class BLA_API ABLABotCharacter : public ABLACharacterBase
{
    GENERATED_BODY()
};
