#pragma once
#include "FPSGameMode.h"
#include "FPSGameplayTypes.h"
#include "FPSGameModeElimination.generated.h"

class AFPSRoundManager;
class AFPSTeamManager;
class AFPSCharacterBase;
class AFPSAIController;
class AFPSRoleAssignment;
class AFPSTacticalManager;
class AFPSTeamOrderManager;

UCLASS(Blueprintable)
class FPS_API AFPSGameModeElimination : public AFPSGameMode
{
    GENERATED_BODY()
public:
    AFPSGameModeElimination();
protected:
    virtual void BeginPlay() override;
private:
    void InitializeMatch();
    AFPSAIController* SpawnBot(EFPS_Team Team, int32 TeamIndex, FName PreferredZone);
    bool EquipLoadout(AFPSCharacterBase* Combatant) const;
    FFPSMatchRules ResolveRules(int32 TeamSize) const;
    UPROPERTY() TObjectPtr<AFPSTeamManager> TeamManager;
    UPROPERTY() TObjectPtr<AFPSRoundManager> RoundManager;
    UPROPERTY() TObjectPtr<AFPSTeamOrderManager> TeamOrderManager;
    UPROPERTY() TObjectPtr<AFPSRoleAssignment> RoleAssignment;
    UPROPERTY() TObjectPtr<AFPSTacticalManager> TacticalManager;
    FTimerHandle InitializeMatchTimer;
};
