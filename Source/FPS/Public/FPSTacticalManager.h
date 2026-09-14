#pragma once

#include "FPSTacticalPoint.h"
#include "GameFramework/Actor.h"
#include "FPSTacticalManager.generated.h"

class APawn;

UCLASS(Blueprintable)
class FPS_API AFPSTacticalManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|Tactical")
    AFPSTacticalPoint* FindBestPoint(APawn* Requester, EFPS_TacticalPointType Type, EFPS_Team Team, EFPS_BotRole RequestedRole) const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Tactical")
    AFPSTacticalPoint* FindNearestReachablePoint(APawn* Requester, EFPS_Team Team) const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Tactical")
    bool ReservePoint(AFPSTacticalPoint* Point);

    UFUNCTION(BlueprintCallable, Category = "FPS|Tactical")
    void ReleasePoint(AFPSTacticalPoint* Point);
};
