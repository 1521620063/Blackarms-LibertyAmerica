#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLATeamManager.generated.h"

class ABLACharacterBase;
class ABLASpawnPoint;

DECLARE_MULTICAST_DELEGATE_TwoParams(FBLATeamCombatantDeathSignature, ABLACharacterBase*, AActor*);

UCLASS(Blueprintable)
class BLA_API ABLATeamManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|Teams")
    bool RegisterCombatant(ABLACharacterBase* Combatant);

    UFUNCTION(BlueprintCallable, Category = "BLA|Teams")
    bool UnregisterCombatant(ABLACharacterBase* Combatant);

    UFUNCTION(BlueprintPure, Category = "BLA|Teams")
    int32 GetLivingCount(EBLA_Team Team) const;

    UFUNCTION(BlueprintPure, Category = "BLA|Teams")
    TArray<ABLACharacterBase*> GetTeamMembers(EBLA_Team Team) const;

    UFUNCTION(BlueprintPure, Category = "BLA|Teams")
    static EBLA_Team GetOpposingTeam(EBLA_Team Team);

    UFUNCTION(BlueprintCallable, Category = "BLA|Spawn")
    ABLASpawnPoint* SelectSpawnPoint(EBLA_Team Team, FName PreferredZone);

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void ResetReservations();

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Teams")
    int32 ConfiguredSlotsPerTeam = 1;

    FBLATeamCombatantDeathSignature OnCombatantDeath;

private:
    void HandleCombatantDeath(AActor* DeadActor, AActor* InstigatorActor);

    UPROPERTY()
    TArray<TObjectPtr<ABLACharacterBase>> Combatants;
};
