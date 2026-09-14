#pragma once

#include "BLATacticalPoint.h"
#include "GameFramework/Actor.h"
#include "BLATacticalManager.generated.h"

class APawn;

UCLASS(Blueprintable)
class BLA_API ABLATacticalManager : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|Tactical")
    ABLATacticalPoint* FindBestPoint(APawn* Requester, EBLA_TacticalPointType Type, EBLA_Team Team, EBLA_BotRole RequestedRole) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Tactical")
    ABLATacticalPoint* FindNearestReachablePoint(APawn* Requester, EBLA_Team Team) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Tactical")
    bool ReservePoint(ABLATacticalPoint* Point);

    UFUNCTION(BlueprintCallable, Category = "BLA|Tactical")
    void ReleasePoint(ABLATacticalPoint* Point);
};
