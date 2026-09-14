#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/PlayerState.h"
#include "FPSPlayerState.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPSPlayerState : public APlayerState
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS")
    EFPS_Team Team = EFPS_Team::Neutral;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "FPS")
    EFPS_DeathState DeathState = EFPS_DeathState::Alive;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "FPS")
    int32 Kills = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "FPS")
    int32 Deaths = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "FPS")
    float DamageDealt = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "FPS")
    float ObjectiveContribution = 0.0f;
};
