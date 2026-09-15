#pragma once

#include "AIController.h"
#include "BLAGameplayTypes.h"
#include "Perception/AIPerceptionTypes.h"
#include "BLAAIController.generated.h"

class ABLATacticalManager;
class ABLATacticalPoint;
class ABLATeamManager;
class ABLATeamOrderManager;
class ABLAObjectiveManager;
class UBehaviorTree;
class UBLABotDifficultyDataAsset;
class UBLABotPerception;
class UAIPerceptionComponent;
enum class EBLA_StimulusType : uint8;

UCLASS(Blueprintable)
class BLA_API ABLAAIController : public AAIController
{
    GENERATED_BODY()

public:
    ABLAAIController();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA|AI")
    TObjectPtr<UAIPerceptionComponent> AIPerception;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA|AI")
    TObjectPtr<UBLABotPerception> BotPerception;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|AI")
    TObjectPtr<UBLABotDifficultyDataAsset> DifficultyAsset;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|AI")
    TObjectPtr<UBehaviorTree> EliminationTree;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|AI")
    EBLA_BotRole BotRole = EBLA_BotRole::Assault;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    bool bIsStuck = false;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float AppliedAimErrorDegrees = 4.0f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float AppliedVisionReactionSeconds = 0.35f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float AppliedFireDelaySeconds = 0.18f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float AppliedSearchSeconds = 7.0f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float AppliedTacticalExecutionProbability = 0.70f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float AppliedTeamAssistProbability = 0.65f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    bool bTargetLost = false;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    float MaxEngagementDistance = 5000.0f;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|AI")
    float SightRadius = 3000.0f;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    TObjectPtr<AActor> DirectiveTarget;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    TObjectPtr<AActor> FollowTarget;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    EBLA_TeamOrder CurrentTeamOrder = EBLA_TeamOrder::FollowPlayer;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    FVector DirectiveLocation = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    bool bHasActiveTeamOrder = false;

    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool UpdateTarget(AActor* Candidate, EBLA_StimulusType StimulusType);
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool AimAndFireAtTarget();
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool MoveToTacticalPoint(ABLATacticalPoint* Point);
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool RecoverFromStuck(ABLATacticalManager* Manager);
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    void ApplyDifficulty(UBLABotDifficultyDataAsset* InDifficulty);
    UFUNCTION(BlueprintPure, Category = "BLA|AI")
    bool IsFireDelayElapsed() const;
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool ResolveRoleDirective(ABLATacticalManager* Manager, ABLATeamManager* TeamManager, AActor* PlayerActor);
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool ResolveTeamOrder(ABLATeamOrderManager* OrderManager, EBLA_RoundPhase Phase);
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    void ConfigureTeamOrders(ABLATeamOrderManager* OrderManager);

    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    void ConfigureObjective(ABLAObjectiveManager* InManager, ABLATacticalManager* InTacticalManager);

    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool ResolveObjectiveDirective(ABLAObjectiveManager* InManager, ABLATacticalManager* InTacticalManager, AActor* PlayerActor);

    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    bool bHasObjectiveDirective = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    FName CurrentObjectiveTask;

protected:
    virtual void OnPossess(APawn* InPawn) override;

private:
    void HandleTeamOrderChanged(EBLA_RoundPhase Phase);
    class ABLASpawnPoint* FindNearestTeamSpawn(const class ABLACharacterBase* Bot) const;
    void UpdateTargetMemory();
    void ScanForTargets();
    bool HasClearShot(const AActor* Candidate) const;
    void UpdateDirectiveFromSources(float DeltaSeconds);
    void TickCombat();
    void TickMovement();
    void IssueDirectiveMove(const FVector& Location, float AcceptanceRadius);
    AActor* ResolveAssistTarget(ABLATeamManager* TeamManager, AActor* PlayerActor);

    UFUNCTION()
    void HandleTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus);

    double TargetAcquiredTime = -1.0;
    double LastFireTime = -1.0;
    double TargetLostTime = -1.0;
    double LastTargetScanTime = -1.0;
    int32 StuckRecoveryCount = 0;
    float DirectiveRefreshElapsed = 0.0f;
    bool bObjectiveOwnsMovement = false;
    bool bHasDirectiveMoveTarget = false;
    FVector LastDirectiveMoveTarget = FVector::ZeroVector;

    UPROPERTY()
    TObjectPtr<ABLATeamOrderManager> TeamOrderManager;
    UPROPERTY()
    TObjectPtr<ABLATacticalManager> RoleTacticalManager;
    UPROPERTY()
    TObjectPtr<ABLATeamManager> RoleTeamManager;
    UPROPERTY()
    TObjectPtr<AActor> RolePlayerActor;
    UPROPERTY()
    TObjectPtr<ABLAObjectiveManager> ObjectiveManager;
    UPROPERTY()
    TObjectPtr<ABLATacticalManager> ObjectiveTacticalManager;
    UPROPERTY()
    bool bHasObjectiveMoveTarget = false;
    FVector LastObjectiveMoveTarget = FVector::ZeroVector;
    FVector LastStuckCheckLocation = FVector::ZeroVector;
    float StuckElapsed = 0.0f;
};
