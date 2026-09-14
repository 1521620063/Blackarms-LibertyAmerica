#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLATacticalPoint.generated.h"

UENUM(BlueprintType)
enum class EBLA_TacticalPointType : uint8
{
    CoverPoint,
    GuardPoint,
    AttackPoint,
    FlankPoint,
    RetreatPoint,
    PlantPoint,
    DefusePoint
};

UCLASS(Blueprintable)
class BLA_API ABLATacticalPoint : public AActor
{
    GENERATED_BODY()

public:
    ABLATacticalPoint();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Tactical")
    EBLA_TacticalPointType PointType = EBLA_TacticalPointType::CoverPoint;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Tactical")
    EBLA_Team Team = EBLA_Team::Neutral;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Tactical")
    EBLA_BotRole PreferredRole = EBLA_BotRole::Assault;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Tactical")
    float Priority = 1.0f;
    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "BLA|Tactical")
    bool bIsOccupied = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Tactical")
    bool bIsObjectivePoint = false;
};
