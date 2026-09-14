#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "BLAGameplayTypes.generated.h"

UENUM(BlueprintType)
enum class EBLA_Team : uint8
{
    Attackers,
    Defenders,
    Neutral
};

UENUM(BlueprintType)
enum class EBLA_MatchMode : uint8
{
    TeamElimination,
    DataCoreAttackDefense
};

UENUM(BlueprintType)
enum class EBLA_RoundPhase : uint8
{
    Loading,
    Preparation,
    Combat,
    ObjectiveUpload,
    RoundResult,
    MatchResult
};

UENUM(BlueprintType)
enum class EBLA_BotRole : uint8
{
    Assault,
    Support,
    Defender
};

UENUM(BlueprintType)
enum class EBLA_TeamOrder : uint8
{
    FollowPlayer,
    HoldHere,
    AttackTarget,
    Retreat
};

UENUM(BlueprintType)
enum class EBLA_WeaponType : uint8
{
    EnergyPistol,
    PulseRifle,
    ScatterGun
};

UENUM(BlueprintType)
enum class EBLA_ObjectiveState : uint8
{
    None,
    Available,
    Carried,
    Dropped,
    Planting,
    Planted,
    Uploading,
    Defusing,
    Defused,
    Completed
};

UENUM(BlueprintType)
enum class EBLA_DeathState : uint8
{
    Alive,
    Dead,
    Spectating
};

UENUM(BlueprintType)
enum class EBLA_DifficultyLevel : uint8
{
    Easy,
    Normal,
    Hard
};

USTRUCT(BlueprintType)
struct BLA_API FBLAMatchRules
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Match")
    int32 TeamSize = 1;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Match")
    float PreparationSeconds = 15.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Match")
    float CombatSeconds = 60.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
    float PlantSeconds = 5.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
    float DefuseSeconds = 5.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
    float UploadSeconds = 30.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Match")
    int32 RoundsToWin = 3;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Match")
    int32 SwitchSidesAfterRound = 2;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Objective")
    int32 ObjectiveCount = 1;
};

USTRUCT(BlueprintType)
struct BLA_API FBLABotDifficulty
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Perception")
    float VisionReactionSeconds = 0.35f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Combat")
    float AimErrorDegrees = 4.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Combat")
    float FireDelaySeconds = 0.18f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Perception")
    float HearingRadius = 1400.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Search")
    float SearchSeconds = 7.0f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tactics", meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float TacticalExecutionProbability = 0.70f;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Tactics", meta = (ClampMin = "0.0", ClampMax = "1.0"))
    float TeamAssistProbability = 0.65f;
};

UCLASS(BlueprintType)
class BLA_API UBLAMatchRulesDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Rules")
    FBLAMatchRules Rules;
};

UCLASS(BlueprintType)
class BLA_API UBLABotDifficultyDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Difficulty")
    FBLABotDifficulty Difficulty;
};
