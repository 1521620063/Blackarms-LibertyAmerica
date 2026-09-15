#include "BLATeamManager.h"

#include "BLACharacterBase.h"
#include "BLADebugSubsystem.h"
#include "BLAHealthComponent.h"
#include "BLASpawnPoint.h"
#include "EngineUtils.h"

bool ABLATeamManager::RegisterCombatant(ABLACharacterBase* Combatant)
{
    if (!Combatant || Combatants.Contains(Combatant))
    {
        return false;
    }
    Combatants.Add(Combatant);
    if (Combatant->HealthComponent)
    {
        Combatant->HealthComponent->OnCombatantDeathNative.AddUObject(this, &ABLATeamManager::HandleCombatantDeath);
    }
    return true;
}

bool ABLATeamManager::UnregisterCombatant(ABLACharacterBase* Combatant)
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

int32 ABLATeamManager::GetLivingCount(EBLA_Team Team) const
{
    int32 Count = 0;
    for (const ABLACharacterBase* Combatant : Combatants)
    {
        if (IsValid(Combatant) && Combatant->Team == Team && Combatant->GetIsAlive())
        {
            ++Count;
        }
    }
    return Count;
}

TArray<ABLACharacterBase*> ABLATeamManager::GetTeamMembers(EBLA_Team Team) const
{
    TArray<ABLACharacterBase*> Result;
    for (ABLACharacterBase* Combatant : Combatants)
    {
        if (IsValid(Combatant) && Combatant->Team == Team)
        {
            Result.Add(Combatant);
        }
    }
    return Result;
}

EBLA_Team ABLATeamManager::GetOpposingTeam(EBLA_Team Team)
{
    return Team == EBLA_Team::Attackers ? EBLA_Team::Defenders
        : Team == EBLA_Team::Defenders ? EBLA_Team::Attackers : EBLA_Team::Neutral;
}

ABLASpawnPoint* ABLATeamManager::SelectSpawnPoint(EBLA_Team Team, FName PreferredZone)
{
    ABLASpawnPoint* TeamFallback = nullptr;
    ABLASpawnPoint* AnyFallback = nullptr;
    for (TActorIterator<ABLASpawnPoint> It(GetWorld()); It; ++It)
    {
        ABLASpawnPoint* Spawn = *It;
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
    ABLASpawnPoint* Result = TeamFallback ? TeamFallback : AnyFallback;
    if (Result)
    {
        Result->bReserved = true;
        if (Result->Team != Team)
        {
            UE_LOG(LogTemp, Warning, TEXT("SPAWN_FALLBACK_USED team=%d spawn=%s reason=no_team_spawn"),
                static_cast<int32>(Team), *Result->GetName());
            if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
            {
                Debug->ReportEvent(TEXT("SPAWN_FALLBACK_USED"),
                    FString::Printf(TEXT("team=%d spawn=%s reason=no_team_spawn"),
                        static_cast<int32>(Team), *Result->GetName()));
            }
        }
    }
    else if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
    {
        UE_LOG(LogTemp, Warning, TEXT("SPAWN_FALLBACK_USED team=%d reason=no_spawn_points"), static_cast<int32>(Team));
        Debug->ReportEvent(TEXT("SPAWN_FALLBACK_USED"),
            FString::Printf(TEXT("team=%d reason=no_spawn_points"), static_cast<int32>(Team)));
    }
    return Result;
}

void ABLATeamManager::ResetReservations()
{
    for (TActorIterator<ABLASpawnPoint> It(GetWorld()); It; ++It)
    {
        It->bReserved = false;
    }
}

void ABLATeamManager::HandleCombatantDeath(AActor* DeadActor, AActor* InstigatorActor)
{
    if (ABLACharacterBase* Combatant = Cast<ABLACharacterBase>(DeadActor))
    {
        OnCombatantDeath.Broadcast(Combatant, InstigatorActor);
    }
}
