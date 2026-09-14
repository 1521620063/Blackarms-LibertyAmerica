#include "FPSGameplayDataValidator.h"

#include "FPSGameplayTypes.h"

namespace
{
    const TCHAR* RuleAssetPaths[] =
    {
        TEXT("/Game/FPS/Data/Rules/DA_FPSMatchRules_Solo.DA_FPSMatchRules_Solo"),
        TEXT("/Game/FPS/Data/Rules/DA_FPSMatchRules_2v2.DA_FPSMatchRules_2v2"),
        TEXT("/Game/FPS/Data/Rules/DA_FPSMatchRules_3v3.DA_FPSMatchRules_3v3")
    };

    const TCHAR* DifficultyAssetPaths[] =
    {
        TEXT("/Game/FPS/Data/AI/DA_FPSBotDifficulty_Easy.DA_FPSBotDifficulty_Easy"),
        TEXT("/Game/FPS/Data/AI/DA_FPSBotDifficulty_Normal.DA_FPSBotDifficulty_Normal"),
        TEXT("/Game/FPS/Data/AI/DA_FPSBotDifficulty_Hard.DA_FPSBotDifficulty_Hard")
    };
}

void AFPSGameplayDataValidator::BeginPlay()
{
    Super::BeginPlay();

    bool bAllValid = true;
    for (const TCHAR* AssetPath : RuleAssetPaths)
    {
        bAllValid &= ValidateRuleAsset(AssetPath);
    }

    for (const TCHAR* AssetPath : DifficultyAssetPaths)
    {
        bAllValid &= ValidateDifficultyAsset(AssetPath);
    }

    if (bAllValid)
    {
        UE_LOG(LogTemp, Display, TEXT("FPS_DATA_VALIDATION_OK assets=6"));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_DATA_VALIDATION_FAILED"));
    }
}

bool AFPSGameplayDataValidator::ValidateRuleAsset(const FString& AssetPath) const
{
    const UFPSMatchRulesDataAsset* Asset = LoadObject<UFPSMatchRulesDataAsset>(nullptr, *AssetPath);
    if (!Asset)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_RULE_INVALID path=%s reason=missing"), *AssetPath);
        return false;
    }

    const FFPSMatchRules& Rules = Asset->Rules;
    const bool bValid = Rules.TeamSize >= 1
        && Rules.RoundsToWin >= 1
        && Rules.PreparationSeconds >= 0.0f
        && Rules.CombatSeconds >= 0.0f
        && Rules.PlantSeconds >= 0.0f
        && Rules.DefuseSeconds >= 0.0f
        && Rules.UploadSeconds >= 0.0f
        && Rules.ObjectiveCount == 1;

    if (bValid)
    {
        UE_LOG(
            LogTemp,
            Display,
            TEXT("FPS_RULE_VALID path=%s team=%d combat=%.0f rounds=%d objectives=%d"),
            *AssetPath,
            Rules.TeamSize,
            Rules.CombatSeconds,
            Rules.RoundsToWin,
            Rules.ObjectiveCount
        );
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_RULE_INVALID path=%s"), *AssetPath);
    }
    return bValid;
}

bool AFPSGameplayDataValidator::ValidateDifficultyAsset(const FString& AssetPath) const
{
    const UFPSBotDifficultyDataAsset* Asset = LoadObject<UFPSBotDifficultyDataAsset>(nullptr, *AssetPath);
    if (!Asset)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_DIFFICULTY_INVALID path=%s reason=missing"), *AssetPath);
        return false;
    }

    const FFPSBotDifficulty& Difficulty = Asset->Difficulty;
    const bool bValid = Difficulty.VisionReactionSeconds >= 0.0f
        && Difficulty.AimErrorDegrees > 0.0f
        && Difficulty.FireDelaySeconds >= 0.0f
        && Difficulty.HearingRadius >= 0.0f
        && Difficulty.SearchSeconds >= 0.0f
        && Difficulty.TacticalExecutionProbability >= 0.0f
        && Difficulty.TacticalExecutionProbability <= 1.0f
        && Difficulty.TeamAssistProbability >= 0.0f
        && Difficulty.TeamAssistProbability <= 1.0f;

    if (bValid)
    {
        UE_LOG(
            LogTemp,
            Display,
            TEXT("FPS_DIFFICULTY_VALID path=%s reaction=%.2f aim_error=%.2f"),
            *AssetPath,
            Difficulty.VisionReactionSeconds,
            Difficulty.AimErrorDegrees
        );
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_DIFFICULTY_INVALID path=%s"), *AssetPath);
    }
    return bValid;
}
