#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/GameStateBase.h"
#include "BLAGameState.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLAGameState : public AGameStateBase
{
    GENERATED_BODY()

public:
    ABLAGameState();

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    EBLA_MatchMode MatchMode = EBLA_MatchMode::TeamElimination;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    EBLA_RoundPhase RoundPhase = EBLA_RoundPhase::Loading;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    int32 CurrentRound = 0;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Score")
    int32 AttackersScore = 0;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Score")
    int32 DefendersScore = 0;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Teams")
    int32 AttackersTeamSize = 0;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Teams")
    int32 DefendersTeamSize = 0;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    float RoundTimeRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Objective")
    EBLA_ObjectiveState CurrentObjectiveState = EBLA_ObjectiveState::None;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    EBLA_DifficultyLevel DifficultyLevel = EBLA_DifficultyLevel::Normal;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|LAN")
    TArray<FBLALanRosterEntry> LANRoster;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    int32 LivingAttackers = 0;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|Match")
    int32 LivingDefenders = 0;

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
