#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/GameStateBase.h"
#include "BLAGameState.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLAGameState : public AGameStateBase
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category = "BLA|Match")
    EBLA_MatchMode MatchMode = EBLA_MatchMode::TeamElimination;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Match")
    EBLA_RoundPhase RoundPhase = EBLA_RoundPhase::Loading;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Match")
    int32 CurrentRound = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Score")
    int32 AttackersScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Score")
    int32 DefendersScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Teams")
    int32 AttackersTeamSize = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Teams")
    int32 DefendersTeamSize = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Match")
    float RoundTimeRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Objective")
    EBLA_ObjectiveState CurrentObjectiveState = EBLA_ObjectiveState::None;
};
