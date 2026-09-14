#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "FPSTeamManager.generated.h"

class AFPSCharacterBase;
class AFPSSpawnPoint;

DECLARE_MULTICAST_DELEGATE_TwoParams(FFPSTeamCombatantDeathSignature, AFPSCharacterBase*, AActor*);

UCLASS(Blueprintable)
class FPS_API AFPSTeamManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|Teams")
    bool RegisterCombatant(AFPSCharacterBase* Combatant);

    UFUNCTION(BlueprintCallable, Category = "FPS|Teams")
    bool UnregisterCombatant(AFPSCharacterBase* Combatant);

    UFUNCTION(BlueprintPure, Category = "FPS|Teams")
    int32 GetLivingCount(EFPS_Team Team) const;

    UFUNCTION(BlueprintPure, Category = "FPS|Teams")
    TArray<AFPSCharacterBase*> GetTeamMembers(EFPS_Team Team) const;

    UFUNCTION(BlueprintPure, Category = "FPS|Teams")
    static EFPS_Team GetOpposingTeam(EFPS_Team Team);

    UFUNCTION(BlueprintCallable, Category = "FPS|Spawn")
    AFPSSpawnPoint* SelectSpawnPoint(EFPS_Team Team, FName PreferredZone);

    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void ResetReservations();

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Teams")
    int32 ConfiguredSlotsPerTeam = 1;

    FFPSTeamCombatantDeathSignature OnCombatantDeath;

private:
    void HandleCombatantDeath(AActor* DeadActor, AActor* InstigatorActor);

    UPROPERTY()
    TArray<TObjectPtr<AFPSCharacterBase>> Combatants;
};
