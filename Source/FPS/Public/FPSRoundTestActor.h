#pragma once

#include "GameFramework/Actor.h"
#include "FPSRoundTestActor.generated.h"

class AFPSCharacterBase;
class AFPSGameState;
class AFPSRoundManager;
class AFPSTeamManager;

UCLASS(Blueprintable)
class FPS_API AFPSRoundTestActor : public AActor
{
    GENERATED_BODY()

public:
    AFPSRoundTestActor();
    virtual void Tick(float DeltaSeconds) override;

protected:
    virtual void BeginPlay() override;

private:
    void Fail(const TCHAR* Reason);
    bool StartCombatRound();

    UPROPERTY()
    TObjectPtr<AFPSGameState> TestGameState;

    UPROPERTY()
    TObjectPtr<AFPSTeamManager> TeamManager;

    UPROPERTY()
    TObjectPtr<AFPSRoundManager> RoundManager;

    UPROPERTY()
    TObjectPtr<AFPSCharacterBase> Attacker;

    UPROPERTY()
    TObjectPtr<AFPSCharacterBase> Defender;

    int32 Stage = 0;
    bool bFinished = false;
};
