#include "BLAGameplayDataValidator.h"

#include "BLAGameplayTypes.h"

namespace
{
    const TCHAR* RuleAssetPaths[] =
    {
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_Solo.DA_BLAMatchRules_Solo"),
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_2v2.DA_BLAMatchRules_2v2"),
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_3v3.DA_BLAMatchRules_3v3")
    };

    const TCHAR* DifficultyAssetPaths[] =
    {
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Easy.DA_BLABotDifficulty_Easy"),
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Normal.DA_BLABotDifficulty_Normal"),
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Hard.DA_BLABotDifficulty_Hard")
    };
}

void ABLAGameplayDataValidator::BeginPlay()
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
        UE_LOG(LogTemp, Display, TEXT("BLA_DATA_VALIDATION_OK assets=6"));
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_DATA_VALIDATION_FAILED"));
    }
}

bool ABLAGameplayDataValidator::ValidateRuleAsset(const FString& AssetPath) const
{
    const UBLAMatchRulesDataAsset* Asset = LoadObject<UBLAMatchRulesDataAsset>(nullptr, *AssetPath);
    if (!Asset)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_RULE_INVALID path=%s reason=missing"), *AssetPath);
        return false;
    }

    const FBLAMatchRules& Rules = Asset->Rules;
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
            TEXT("BLA_RULE_VALID path=%s team=%d combat=%.0f rounds=%d objectives=%d"),
            *AssetPath,
            Rules.TeamSize,
            Rules.CombatSeconds,
            Rules.RoundsToWin,
            Rules.ObjectiveCount
        );
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_RULE_INVALID path=%s"), *AssetPath);
    }
    return bValid;
}

bool ABLAGameplayDataValidator::ValidateDifficultyAsset(const FString& AssetPath) const
{
    const UBLABotDifficultyDataAsset* Asset = LoadObject<UBLABotDifficultyDataAsset>(nullptr, *AssetPath);
    if (!Asset)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_DIFFICULTY_INVALID path=%s reason=missing"), *AssetPath);
        return false;
    }

    const FBLABotDifficulty& Difficulty = Asset->Difficulty;
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
            TEXT("BLA_DIFFICULTY_VALID path=%s reaction=%.2f aim_error=%.2f"),
            *AssetPath,
            Difficulty.VisionReactionSeconds,
            Difficulty.AimErrorDegrees
        );
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_DIFFICULTY_INVALID path=%s"), *AssetPath);
    }
    return bValid;
}
