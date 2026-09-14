#include "FPSTeamManager.h"

#include "FPSCharacterBase.h"
#include "FPSHealthComponent.h"
#include "FPSSpawnPoint.h"
#include "EngineUtils.h"

bool AFPSTeamManager::RegisterCombatant(AFPSCharacterBase* Combatant)
{
    if (!Combatant || Combatants.Contains(Combatant))
    {
        return false;
    }
    Combatants.Add(Combatant);
    if (Combatant->HealthComponent)
    {
        Combatant->HealthComponent->OnCombatantDeathNative.AddUObject(this, &AFPSTeamManager::HandleCombatantDeath);
    }
    return true;
}

bool AFPSTeamManager::UnregisterCombatant(AFPSCharacterBase* Combatant)
{
    if (!Combatant || !Combatants.RemoveSingle(Combatant))
    {
        return false;
    }
    if (Combatant->HealthComponent)
    {
        Combatant->HealthComponent->OnCombatantDeathNative.RemoveAll(this);
    }
    return true;
}

int32 AFPSTeamManager::GetLivingCount(EFPS_Team Team) const
{
    int32 Count = 0;
    for (const AFPSCharacterBase* Combatant : Combatants)
    {
        if (IsValid(Combatant) && Combatant->Team == Team && Combatant->GetIsAlive())
        {
            ++Count;
        }
    }
    return Count;
}

TArray<AFPSCharacterBase*> AFPSTeamManager::GetTeamMembers(EFPS_Team Team) const
{
    TArray<AFPSCharacterBase*> Result;
    for (AFPSCharacterBase* Combatant : Combatants)
    {
        if (IsValid(Combatant) && Combatant->Team == Team)
        {
            Result.Add(Combatant);
        }
    }
    return Result;
}

EFPS_Team AFPSTeamManager::GetOpposingTeam(EFPS_Team Team)
{
    return Team == EFPS_Team::Attackers ? EFPS_Team::Defenders
        : Team == EFPS_Team::Defenders ? EFPS_Team::Attackers : EFPS_Team::Neutral;
}

AFPSSpawnPoint* AFPSTeamManager::SelectSpawnPoint(EFPS_Team Team, FName PreferredZone)
{
    AFPSSpawnPoint* TeamFallback = nullptr;
    AFPSSpawnPoint* AnyFallback = nullptr;
    for (TActorIterator<AFPSSpawnPoint> It(GetWorld()); It; ++It)
    {
        AFPSSpawnPoint* Spawn = *It;
        if (Spawn->bReserved)
        {
            continue;
        }
        if (!AnyFallback)
        {
            AnyFallback = Spawn;
        }
        if (Spawn->Team == Team)
        {
            TeamFallback = TeamFallback ? TeamFallback : Spawn;
            if (PreferredZone.IsNone() || Spawn->Zone == PreferredZone)
            {
                Spawn->bReserved = true;
                return Spawn;
            }
        }
    }
    AFPSSpawnPoint* Result = TeamFallback ? TeamFallback : AnyFallback;
    if (Result)
    {
        Result->bReserved = true;
    }
    return Result;
}

void AFPSTeamManager::ResetReservations()
{
    for (TActorIterator<AFPSSpawnPoint> It(GetWorld()); It; ++It)
    {
        It->bReserved = false;
    }
}

void AFPSTeamManager::HandleCombatantDeath(AActor* DeadActor, AActor* InstigatorActor)
{
    if (AFPSCharacterBase* Combatant = Cast<AFPSCharacterBase>(DeadActor))
    {
        OnCombatantDeath.Broadcast(Combatant, InstigatorActor);
    }
}
