#pragma once

#include "BLAGameplayTypes.h"
#include "Engine/GameInstance.h"
#include "BLAGameInstance.generated.h"

class UBLABotDifficultyDataAsset;
class UBLAMatchRulesDataAsset;

UCLASS(Blueprintable)
class BLA_API UBLAGameInstance : public UGameInstance
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Selection")
    EBLA_MatchMode SelectedMode = EBLA_MatchMode::TeamElimination;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Selection")
    TObjectPtr<UBLAMatchRulesDataAsset> SelectedRules;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Selection")
    TObjectPtr<UBLABotDifficultyDataAsset> SelectedDifficulty;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Selection", meta = (ClampMin = "1", ClampMax = "3"))
    int32 SelectedTeamSize = 1;
};
