#pragma once

#include "AIController.h"
#include "FPSGameplayTypes.h"
#include "FPSAIController.generated.h"

class AFPSTacticalManager;
class AFPSTacticalPoint;
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

protected:
    virtual void OnPossess(APawn* InPawn) override;

private:
    FVector LastStuckCheckLocation = FVector::ZeroVector;
    float StuckElapsed = 0.0f;
};
