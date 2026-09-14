#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLARoundManager.generated.h"

class ABLACharacterBase;
class ABLAGameState;
class ABLATeamManager;
class ABLATeamOrderManager;

UCLASS(BlueprintType, Blueprintable)
class BLA_API UBLARoundResultData : public UObject
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category = "BLA|Round")
    EBLA_Team Winner = EBLA_Team::Neutral;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Round")
    FName Reason;
};

UCLASS(Blueprintable)
class BLA_API ABLARoundManager : public AActor
{
    GENERATED_BODY()

public:
    ABLARoundManager();
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void StartMatch(const FBLAMatchRules& Rules);
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void StartPreparationPhase();
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void StartCombatPhase();
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    bool EndRound(EBLA_Team Winner, FName Reason);
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void SwitchSidesIfRequired();
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void StartNextRound();
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void EndMatch(EBLA_Team Winner);
    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void ResetAllCombatants();

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    FBLAMatchRules GetActiveRules() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    void ConfigureManagers(ABLAGameState* InGameState, ABLATeamManager* InTeamManager,
        ABLATeamOrderManager* InOrderManager = nullptr);

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Round")
    TObjectPtr<ABLAGameState> BLAGameState;
    UPROPERTY(BlueprintReadWrite, Category = "BLA|Round")
    TObjectPtr<ABLATeamManager> TeamManager;
    UPROPERTY(BlueprintReadWrite, Category = "BLA|Round")
    TObjectPtr<ABLATeamOrderManager> TeamOrderManager;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|Round")
    TObjectPtr<UBLARoundResultData> LastResult;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|Round")
    bool bIsRoundEnding = false;

protected:
    virtual void BeginPlay() override;

private:
    void HandleCombatantDeath(ABLACharacterBase* DeadCombatant, AActor* InstigatorActor);
    void EvaluateTimeout();
    float GetRemainingHealth(EBLA_Team Team) const;

    FBLAMatchRules ActiveRules;
    bool bOvertimeUsed = false;
};
