#pragma once

#include "BLAGameplayTypes.h"
#include "Engine/DataAsset.h"
#include "GameFramework/Actor.h"
#include "BLAMapConfig.generated.h"

class ABLADataCore;
class ABLAMapZone;
class ABLAObjectiveManager;
class ABLAObjectiveZone;

/** Data half of a map config: what the map supports, without actor references. */
UCLASS(BlueprintType)
class BLA_API UBLAMapConfigDataAsset : public UPrimaryDataAsset
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    FName MapId = TEXT("ZeroFacility");

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TArray<EBLA_MatchMode> SupportedModes;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TArray<int32> SupportedTeamSizes;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    int32 SpawnPointsPerTeam = 3;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    int32 CoverPieces = 6;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TArray<FName> RouteNames;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    bool bSupportsObjective = true;
};

/**
 * Actor half of the map config: the level references the game mode reads instead of
 * searching the world by class name.
 */
UCLASS(Blueprintable)
class BLA_API ABLAMapConfig : public AActor
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TObjectPtr<UBLAMapConfigDataAsset> Config;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TArray<TObjectPtr<ABLAMapZone>> Zones;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TObjectPtr<ABLAObjectiveManager> ObjectiveManager;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TObjectPtr<ABLADataCore> DataCore;

    UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "BLA|Map")
    TObjectPtr<ABLAObjectiveZone> ObjectiveZone;

    UFUNCTION(BlueprintPure, Category = "BLA|Map")
    bool SupportsMode(EBLA_MatchMode Mode) const;

    UFUNCTION(BlueprintPure, Category = "BLA|Map")
    bool SupportsTeamSize(int32 TeamSize) const;

    UFUNCTION(BlueprintPure, Category = "BLA|Map")
    int32 ResolveSupportedTeamSize(int32 Requested) const;

    UFUNCTION(BlueprintPure, Category = "BLA|Map")
    ABLAMapZone* FindZone(EBLA_MapZoneType Type) const;
};
