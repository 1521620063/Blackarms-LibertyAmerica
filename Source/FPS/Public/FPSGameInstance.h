#pragma once

#include "FPSGameplayTypes.h"
#include "Engine/GameInstance.h"
#include "FPSGameInstance.generated.h"

class UFPSBotDifficultyDataAsset;
class UFPSMatchRulesDataAsset;

UCLASS(Blueprintable)
class FPS_API UFPSGameInstance : public UGameInstance
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Selection")
    EFPS_MatchMode SelectedMode = EFPS_MatchMode::TeamElimination;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Selection")
    TObjectPtr<UFPSMatchRulesDataAsset> SelectedRules;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Selection")
    TObjectPtr<UFPSBotDifficultyDataAsset> SelectedDifficulty;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "FPS|Selection", meta = (ClampMin = "1", ClampMax = "3"))
    int32 SelectedTeamSize = 1;
};
