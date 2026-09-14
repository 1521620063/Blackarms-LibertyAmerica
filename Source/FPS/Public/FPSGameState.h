#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/GameStateBase.h"
#include "FPSGameState.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPSGameState : public AGameStateBase
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category = "FPS|Match")
    EFPS_MatchMode MatchMode = EFPS_MatchMode::TeamElimination;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Match")
    EFPS_RoundPhase RoundPhase = EFPS_RoundPhase::Loading;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Match")
    int32 CurrentRound = 0;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Score")
    int32 AttackersScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Score")
    int32 DefendersScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Teams")
    int32 AttackersTeamSize = 0;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Teams")
    int32 DefendersTeamSize = 0;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Match")
    float RoundTimeRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Objective")
    EFPS_ObjectiveState CurrentObjectiveState = EFPS_ObjectiveState::None;
};
