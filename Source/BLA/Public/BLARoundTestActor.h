#pragma once

#include "GameFramework/Actor.h"
#include "BLARoundTestActor.generated.h"

class ABLACharacterBase;
class ABLAGameState;
class ABLARoundManager;
class ABLATeamManager;

UCLASS(Blueprintable)
class BLA_API ABLARoundTestActor : public AActor
{
    GENERATED_BODY()

public:
    ABLARoundTestActor();
    virtual void Tick(float DeltaSeconds) override;

protected:
    virtual void BeginPlay() override;

private:
    void Fail(const TCHAR* Reason);
    bool StartCombatRound();

    UPROPERTY()
    TObjectPtr<ABLAGameState> TestGameState;

    UPROPERTY()
    TObjectPtr<ABLATeamManager> TeamManager;

    UPROPERTY()
    TObjectPtr<ABLARoundManager> RoundManager;

    UPROPERTY()
    TObjectPtr<ABLACharacterBase> Attacker;

    UPROPERTY()
    TObjectPtr<ABLACharacterBase> Defender;

    int32 Stage = 0;
    bool bFinished = false;
};
