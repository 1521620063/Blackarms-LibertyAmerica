#pragma once
#include "BLAGameMode.h"
#include "BLAGameplayTypes.h"
#include "BLAGameModeElimination.generated.h"

class ABLARoundManager;
class ABLATeamManager;
class ABLACharacterBase;
class ABLAAIController;
class ABLARoleAssignment;
class ABLATacticalManager;
class ABLATeamOrderManager;

UCLASS(Blueprintable)
class BLA_API ABLAGameModeElimination : public ABLAGameMode
{
    GENERATED_BODY()
public:
    ABLAGameModeElimination();
protected:
    virtual void BeginPlay() override;
private:
    void InitializeMatch();
    ABLAAIController* SpawnBot(EBLA_Team Team, int32 TeamIndex, FName PreferredZone);
    bool EquipLoadout(ABLACharacterBase* Combatant) const;
    FBLAMatchRules ResolveRules(int32 TeamSize) const;
    UPROPERTY() TObjectPtr<ABLATeamManager> TeamManager;
    UPROPERTY() TObjectPtr<ABLARoundManager> RoundManager;
    UPROPERTY() TObjectPtr<ABLATeamOrderManager> TeamOrderManager;
    UPROPERTY() TObjectPtr<ABLARoleAssignment> RoleAssignment;
    UPROPERTY() TObjectPtr<ABLATacticalManager> TacticalManager;
    FTimerHandle InitializeMatchTimer;
};
