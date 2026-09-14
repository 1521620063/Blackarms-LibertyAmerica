#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/PlayerStart.h"
#include "FPSSpawnPoint.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPSSpawnPoint : public APlayerStart
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Spawn")
    EFPS_Team Team = EFPS_Team::Neutral;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Spawn")
    FName Zone;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "FPS|Spawn")
    bool bReserved = false;
};
