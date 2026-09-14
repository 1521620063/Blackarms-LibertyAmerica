#include "FPSHealthComponent.h"

UFPSHealthComponent::UFPSHealthComponent()
{
    PrimaryComponentTick.bCanEverTick = false;
}

bool UFPSHealthComponent::ApplyDamage(float Amount, FName DamageLocation, AActor* InstigatorActor)
{
    if (bIsDead || Amount <= 0.0f)
    {
        return false;
    }

    const float PreviousHealth = CurrentHealth;
    CurrentHealth = FMath::Clamp(CurrentHealth - Amount, 0.0f, MaxHealth);
    const float AppliedDamage = PreviousHealth - CurrentHealth;
    if (AppliedDamage <= 0.0f)
    {
        return false;
    }

    OnHealthChanged.Broadcast(CurrentHealth, -AppliedDamage);
    if (CurrentHealth <= 0.0f)
    {
        HandleDeath(InstigatorActor);
    }
    return true;
}

void UFPSHealthComponent::ResetHealth()
{
    const float PreviousHealth = CurrentHealth;
    bIsDead = false;
    CurrentHealth = FMath::Max(1.0f, MaxHealth);
    if (!FMath::IsNearlyEqual(PreviousHealth, CurrentHealth))
    {
        OnHealthChanged.Broadcast(CurrentHealth, CurrentHealth - PreviousHealth);
    }
}

void UFPSHealthComponent::HandleDeath(AActor* InstigatorActor)
{
    if (bIsDead)
    {
        return;
    }

    bIsDead = true;
    CurrentHealth = 0.0f;
    OnDeath.Broadcast(InstigatorActor);
    OnDeathNative.Broadcast(InstigatorActor);
    OnCombatantDeathNative.Broadcast(GetOwner(), InstigatorActor);
}
