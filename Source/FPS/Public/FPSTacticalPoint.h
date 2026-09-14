#pragma once

#include "FPSGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "FPSTacticalPoint.generated.h"

UENUM(BlueprintType)
enum class EFPS_TacticalPointType : uint8
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
class FPS_API AFPSTacticalPoint : public AActor
{
    GENERATED_BODY()

public:
    AFPSTacticalPoint();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Tactical")
    EFPS_TacticalPointType PointType = EFPS_TacticalPointType::CoverPoint;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Tactical")
    EFPS_Team Team = EFPS_Team::Neutral;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Tactical")
    EFPS_BotRole PreferredRole = EFPS_BotRole::Assault;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Tactical")
    float Priority = 1.0f;
    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Category = "FPS|Tactical")
    bool bIsOccupied = false;
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Tactical")
    bool bIsObjectivePoint = false;
};
