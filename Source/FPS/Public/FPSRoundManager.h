#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "FPSRoundManager.generated.h"

class AFPSCharacterBase;
class AFPSGameState;
class AFPSTeamManager;
class AFPSTeamOrderManager;

UCLASS(BlueprintType, Blueprintable)
class FPS_API UFPSRoundResultData : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category = "FPS|Round")
    EFPS_Team Winner = EFPS_Team::Neutral;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Round")
    FName Reason;
};

UCLASS(Blueprintable)
class FPS_API AFPSRoundManager : public AActor
{
    GENERATED_BODY()

public:
    AFPSRoundManager();
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void StartMatch(const FFPSMatchRules& Rules);
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void StartPreparationPhase();
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void StartCombatPhase();
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    bool EndRound(EFPS_Team Winner, FName Reason);
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void SwitchSidesIfRequired();
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void StartNextRound();
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void EndMatch(EFPS_Team Winner);
    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void ResetAllCombatants();

    UFUNCTION(BlueprintCallable, Category = "FPS|Round")
    void ConfigureManagers(AFPSGameState* InGameState, AFPSTeamManager* InTeamManager,
        AFPSTeamOrderManager* InOrderManager = nullptr);

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Round")
    TObjectPtr<AFPSGameState> FPSGameState;
    UPROPERTY(BlueprintReadWrite, Category = "FPS|Round")
    TObjectPtr<AFPSTeamManager> TeamManager;
    UPROPERTY(BlueprintReadWrite, Category = "FPS|Round")
    TObjectPtr<AFPSTeamOrderManager> TeamOrderManager;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|Round")
    TObjectPtr<UFPSRoundResultData> LastResult;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|Round")
    bool bIsRoundEnding = false;

protected:
    virtual void BeginPlay() override;

private:
    void HandleCombatantDeath(AFPSCharacterBase* DeadCombatant, AActor* InstigatorActor);
    void EvaluateTimeout();
    float GetRemainingHealth(EFPS_Team Team) const;

    FFPSMatchRules ActiveRules;
    bool bOvertimeUsed = false;
};
