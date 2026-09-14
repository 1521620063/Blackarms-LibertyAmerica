#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/PlayerStart.h"
#include "BLASpawnPoint.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLASpawnPoint : public APlayerStart
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Spawn")
    EBLA_Team Team = EBLA_Team::Neutral;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Spawn")
    FName Zone;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "BLA|Spawn")
    bool bReserved = false;
};
