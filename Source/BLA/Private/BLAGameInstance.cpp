#include "BLAGameInstance.h"

#include "BLASettingsSaveGame.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    const TCHAR* GameInstanceDifficultyPaths[] =
    {
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Easy.DA_BLABotDifficulty_Easy"),
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Normal.DA_BLABotDifficulty_Normal"),
        TEXT("/Game/BLA/Data/AI/DA_BLABotDifficulty_Hard.DA_BLABotDifficulty_Hard")
    };

    const TCHAR* GameInstanceRulesPaths[] =
    {
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_Solo.DA_BLAMatchRules_Solo"),
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_2v2.DA_BLAMatchRules_2v2"),
        TEXT("/Game/BLA/Data/Rules/DA_BLAMatchRules_3v3.DA_BLAMatchRules_3v3")
    };
}

void UBLAGameInstance::ApplyModeSelection(EBLA_MatchMode Mode)
{
    SelectedMode = Mode;
}

void UBLAGameInstance::ApplyTeamSize(int32 TeamSize)
{
    SelectedTeamSize = FMath::Clamp(TeamSize, 1, 3);
    SelectedRules = LoadObject<UBLAMatchRulesDataAsset>(nullptr, GameInstanceRulesPaths[SelectedTeamSize - 1]);
}

void UBLAGameInstance::ApplyDifficultyLevel(EBLA_DifficultyLevel Level)
{
    SelectedDifficultyLevel = Level;
    SelectedDifficulty = LoadObject<UBLABotDifficultyDataAsset>(
        nullptr, GameInstanceDifficultyPaths[static_cast<int32>(Level)]);
}

void UBLAGameInstance::SaveSettings()
{
    if (!Settings)
    {
        Settings = NewObject<UBLASettingsSaveGame>(this);
    }
    UGameplayStatics::SaveGameToSlot(Settings, SettingsSlotName, 0);
}

void UBLAGameInstance::LoadSettings()
{
    if (UGameplayStatics::DoesSaveGameExist(SettingsSlotName, 0))
    {
        Settings = Cast<UBLASettingsSaveGame>(UGameplayStatics::LoadGameFromSlot(SettingsSlotName, 0));
    }
    if (!Settings)
    {
        Settings = NewObject<UBLASettingsSaveGame>(this);
    }
}

void UBLAGameInstance::ResetSettings()
{
    Settings = NewObject<UBLASettingsSaveGame>(this);
    UGameplayStatics::SaveGameToSlot(Settings, SettingsSlotName, 0);
}

bool UBLAGameInstance::TravelTo(const FString& MapPath)
{
    if (MapPath.IsEmpty())
    {
        return false;
    }
    LastTravelRequest = MapPath;
    if (bTravelImmediately)
    {
        UGameplayStatics::OpenLevel(this, FName(*MapPath));
    }
    return true;
}

void UBLAGameInstance::RequestStartMatch()
{
    TravelTo(MatchMapPath);
}

void UBLAGameInstance::RequestReturnToMenu()
{
    TravelTo(MenuMapPath);
}
