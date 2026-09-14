#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLAObjectiveManager.generated.h"

class ABLACharacterBase;
class ABLADataCore;
class ABLAGameState;
class ABLAObjectiveZone;
class ABLARoundManager;
class ABLATeamManager;

/**
 * Authority for the Data Core objective. It owns the only interaction timer in
 * the objective mode and the only code path that can complete plant, defuse, or
 * upload; every terminal outcome is routed through
 * ABLARoundManager::EndRound, so round scoring stays in the round manager.
 */
UCLASS(Blueprintable)
class BLA_API ABLAObjectiveManager : public AActor
{
    GENERATED_BODY()

public:
    ABLAObjectiveManager();
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void Configure(ABLAGameState* InGameState, ABLARoundManager* InRoundManager, ABLADataCore* InDataCore,
        ABLAObjectiveZone* InZone, ABLATeamManager* InTeamManager);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    bool BeginPickup(ABLACharacterBase* Interactor);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    bool BeginPlant(ABLACharacterBase* Interactor);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    bool BeginDefuse(ABLACharacterBase* Interactor);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void CancelInteraction(AActor* Interactor, FName Reason);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void HandleCarrierDeath(ABLACharacterBase* Carrier);

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void ResetObjective();

    UFUNCTION(BlueprintPure, Category = "BLA|Objective")
    bool IsObjectiveInValidArea() const;

    UFUNCTION(BlueprintPure, Category = "BLA|Objective")
    bool IsPlanted() const;

    UFUNCTION(BlueprintPure, Category = "BLA|Objective")
    bool IsInteractionActive() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Objective")
    void ClearCoreRecoveryFlag();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    EBLA_ObjectiveState ObjectiveState = EBLA_ObjectiveState::None;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    TObjectPtr<AActor> ActiveInteractor;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    float InteractionRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    float UploadRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    FName LastCancelReason;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    bool bCoreRecovered = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    FName LastRecoveryReason;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Objective")
    float PickupRange = 200.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Objective")
    float MovementCancelTolerance = 25.0f;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Objective")
    TObjectPtr<ABLAGameState> BLAGameState;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Objective")
    TObjectPtr<ABLARoundManager> RoundManager;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Objective")
    TObjectPtr<ABLADataCore> DataCore;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Objective")
    TObjectPtr<ABLAObjectiveZone> ObjectiveZone;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Objective")
    TObjectPtr<ABLATeamManager> TeamManager;

protected:
    virtual void BeginPlay() override;

private:
    void SetObjectiveState(EBLA_ObjectiveState NewState);
    void SetActiveInteractor(ABLACharacterBase* Interactor);
    void ClearActiveInteractor();
    void CompletePlant();
    void CompleteDefuse();
    void CompleteUpload();
    void ObserveRoundPhase();
    void RecoverCoreIfNeeded();
    bool IsInteractorUsable(const ABLACharacterBase* Interactor) const;
    FBLAMatchRules ResolveRules() const;

    UFUNCTION()
    void HandleInteractorHealthChanged(float CurrentHealth, float Delta);

    UFUNCTION()
    void HandleInteractorDeath(AActor* InstigatorActor);

    void HandleCombatantDeath(ABLACharacterBase* DeadCombatant, AActor* InstigatorActor);

    FVector InteractionStartLocation = FVector::ZeroVector;
    EBLA_ObjectiveState StateBeforeInteraction = EBLA_ObjectiveState::None;
    EBLA_RoundPhase LastObservedPhase = EBLA_RoundPhase::Loading;
};
