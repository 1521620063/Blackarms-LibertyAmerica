#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "FPSObjectiveManager.generated.h"

class AFPSCharacterBase;
class AFPSDataCore;
class AFPSGameState;
class AFPSObjectiveZone;
class AFPSRoundManager;
class AFPSTeamManager;

/**
 * Authority for the Data Core objective. It owns the only interaction timer in
 * the objective mode and the only code path that can complete plant, defuse, or
 * upload; every terminal outcome is routed through
 * AFPSRoundManager::EndRound, so round scoring stays in the round manager.
 */
UCLASS(Blueprintable)
class FPS_API AFPSObjectiveManager : public AActor
{
    GENERATED_BODY()

public:
    AFPSObjectiveManager();
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void Configure(AFPSGameState* InGameState, AFPSRoundManager* InRoundManager, AFPSDataCore* InDataCore,
        AFPSObjectiveZone* InZone, AFPSTeamManager* InTeamManager);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    bool BeginPickup(AFPSCharacterBase* Interactor);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    bool BeginPlant(AFPSCharacterBase* Interactor);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    bool BeginDefuse(AFPSCharacterBase* Interactor);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void CancelInteraction(AActor* Interactor, FName Reason);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void HandleCarrierDeath(AFPSCharacterBase* Carrier);

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void ResetObjective();

    UFUNCTION(BlueprintPure, Category = "FPS|Objective")
    bool IsObjectiveInValidArea() const;

    UFUNCTION(BlueprintPure, Category = "FPS|Objective")
    bool IsPlanted() const;

    UFUNCTION(BlueprintPure, Category = "FPS|Objective")
    bool IsInteractionActive() const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Objective")
    void ClearCoreRecoveryFlag();

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    EFPS_ObjectiveState ObjectiveState = EFPS_ObjectiveState::None;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    TObjectPtr<AActor> ActiveInteractor;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    float InteractionRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    float UploadRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    FName LastCancelReason;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    bool bCoreRecovered = false;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    FName LastRecoveryReason;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Objective")
    float PickupRange = 200.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Objective")
    float MovementCancelTolerance = 25.0f;

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Objective")
    TObjectPtr<AFPSGameState> FPSGameState;

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Objective")
    TObjectPtr<AFPSRoundManager> RoundManager;

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Objective")
    TObjectPtr<AFPSDataCore> DataCore;

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Objective")
    TObjectPtr<AFPSObjectiveZone> ObjectiveZone;

    UPROPERTY(BlueprintReadWrite, Category = "FPS|Objective")
    TObjectPtr<AFPSTeamManager> TeamManager;

protected:
    virtual void BeginPlay() override;

private:
    void SetObjectiveState(EFPS_ObjectiveState NewState);
    void SetActiveInteractor(AFPSCharacterBase* Interactor);
    void ClearActiveInteractor();
    void CompletePlant();
    void CompleteDefuse();
    void CompleteUpload();
    void ObserveRoundPhase();
    void RecoverCoreIfNeeded();
    bool IsInteractorUsable(const AFPSCharacterBase* Interactor) const;
    FFPSMatchRules ResolveRules() const;

    UFUNCTION()
    void HandleInteractorHealthChanged(float CurrentHealth, float Delta);

    UFUNCTION()
    void HandleInteractorDeath(AActor* InstigatorActor);

    void HandleCombatantDeath(AFPSCharacterBase* DeadCombatant, AActor* InstigatorActor);

    FVector InteractionStartLocation = FVector::ZeroVector;
    EFPS_ObjectiveState StateBeforeInteraction = EFPS_ObjectiveState::None;
    EFPS_RoundPhase LastObservedPhase = EFPS_RoundPhase::Loading;
};
