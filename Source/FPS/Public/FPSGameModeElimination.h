#pragma once
#include "FPSGameMode.h"
#include "FPSGameModeElimination.generated.h"

class AFPSRoundManager;
class AFPSTeamManager;
class AFPSCharacterBase;

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
    bool EquipSoloLoadout(AFPSCharacterBase* Combatant) const;
    UPROPERTY() TObjectPtr<AFPSTeamManager> TeamManager;
    UPROPERTY() TObjectPtr<AFPSRoundManager> RoundManager;
};
