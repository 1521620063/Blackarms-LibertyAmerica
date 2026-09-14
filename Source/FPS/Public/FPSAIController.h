#pragma once

#include "AIController.h"
#include "FPSGameplayTypes.h"
#include "FPSAIController.generated.h"

class AFPSTacticalManager;
class AFPSTacticalPoint;
class AFPSTeamManager;
class AFPSTeamOrderManager;
class AFPSObjectiveManager;
class UBehaviorTree;
class UFPSBotDifficultyDataAsset;
class UFPSBotPerception;
class UAIPerceptionComponent;
enum class EFPS_StimulusType : uint8;

UCLASS(Blueprintable)
class FPS_API AFPSAIController : public AAIController
{
    GENERATED_BODY()

public:
    AFPSAIController();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS|AI")
    TObjectPtr<UAIPerceptionComponent> AIPerception;
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS|AI")
    TObjectPtr<UFPSBotPerception> BotPerception;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|AI")
    TObjectPtr<UFPSBotDifficultyDataAsset> DifficultyAsset;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|AI")
    TObjectPtr<UBehaviorTree> EliminationTree;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|AI")
    EFPS_BotRole BotRole = EFPS_BotRole::Assault;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    bool bIsStuck = false;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    float AppliedAimErrorDegrees = 4.0f;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    float MaxEngagementDistance = 5000.0f;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    TObjectPtr<AActor> DirectiveTarget;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    TObjectPtr<AActor> FollowTarget;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    EFPS_TeamOrder CurrentTeamOrder = EFPS_TeamOrder::FollowPlayer;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    FVector DirectiveLocation = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    bool bHasActiveTeamOrder = false;

    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool UpdateTarget(AActor* Candidate, EFPS_StimulusType StimulusType);
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool AimAndFireAtTarget();
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool MoveToTacticalPoint(AFPSTacticalPoint* Point);
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool RecoverFromStuck(AFPSTacticalManager* Manager);
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    void ApplyDifficulty(UFPSBotDifficultyDataAsset* InDifficulty);
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool ResolveRoleDirective(AFPSTacticalManager* Manager, AFPSTeamManager* TeamManager, AActor* PlayerActor);
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool ResolveTeamOrder(AFPSTeamOrderManager* OrderManager, EFPS_RoundPhase Phase);
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    void ConfigureTeamOrders(AFPSTeamOrderManager* OrderManager);

    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    void ConfigureObjective(AFPSObjectiveManager* InManager, AFPSTacticalManager* InTacticalManager);

    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool ResolveObjectiveDirective(AFPSObjectiveManager* InManager, AFPSTacticalManager* InTacticalManager, AActor* PlayerActor);

    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    bool bHasObjectiveDirective = false;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    FName CurrentObjectiveTask;

protected:
    virtual void OnPossess(APawn* InPawn) override;

private:
    void HandleTeamOrderChanged(EFPS_RoundPhase Phase);

    UPROPERTY()
    TObjectPtr<AFPSTeamOrderManager> TeamOrderManager;
    UPROPERTY()
    TObjectPtr<AFPSTacticalManager> RoleTacticalManager;
    UPROPERTY()
    TObjectPtr<AFPSTeamManager> RoleTeamManager;
    UPROPERTY()
    TObjectPtr<AActor> RolePlayerActor;
    UPROPERTY()
    TObjectPtr<AFPSObjectiveManager> ObjectiveManager;
    UPROPERTY()
    TObjectPtr<AFPSTacticalManager> ObjectiveTacticalManager;
    UPROPERTY()
    bool bHasObjectiveMoveTarget = false;
    FVector LastObjectiveMoveTarget = FVector::ZeroVector;
    FVector LastStuckCheckLocation = FVector::ZeroVector;
    float StuckElapsed = 0.0f;
};
