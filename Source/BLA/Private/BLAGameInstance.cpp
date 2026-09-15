#include "BLAGameInstance.h"

#include "BLADebugSubsystem.h"
#include "BLASettingsSaveGame.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/PackageName.h"

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

bool UBLAGameInstance::ApplyTeamSize(int32 TeamSize)
{
    if (TeamSize < 1 || TeamSize > 3)
    {
        ReportFlowFailure(TEXT("FLOW_INVALID_TEAM_SIZE"), FString::Printf(TEXT("team_size=%d"), TeamSize));
        return false;
    }
    SelectedTeamSize = TeamSize;
    SelectedRules = LoadObject<UBLAMatchRulesDataAsset>(nullptr, GameInstanceRulesPaths[SelectedTeamSize - 1]);
    LastFlowError.Empty();
    return true;
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

void UBLAGameInstance::ReportFlowFailure(const FString& Code, const FString& Details)
{
    LastFlowError = Details.IsEmpty() ? Code : FString::Printf(TEXT("%s %s"), *Code, *Details);
    if (UBLADebugSubsystem* Debug = GetSubsystem<UBLADebugSubsystem>())
    {
        Debug->ReportEvent(FName(*Code), LastFlowError);
    }
    else
    {
        UE_LOG(LogTemp, Warning, TEXT("BLA_FLOW_FAILED %s"), *LastFlowError);
    }
}

bool UBLAGameInstance::IsCurrentMap(const FString& MapPath) const
{
    const UWorld* World = GetWorld();
    if (!World || MapPath.IsEmpty())
    {
        return false;
    }
    const FString ShortName = FPackageName::GetShortName(MapPath);
    return !ShortName.IsEmpty() && World->GetMapName().Contains(ShortName);
}

void UBLAGameInstance::OnWorldChanged(UWorld* OldWorld, UWorld* NewWorld)
{
    Super::OnWorldChanged(OldWorld, NewWorld);
    if (NewWorld)
    {
        bTravelInProgress = false;
    }
}

bool UBLAGameInstance::TravelTo(const FString& MapPath)
{
    if (MapPath.IsEmpty())
    {
        ReportFlowFailure(TEXT("FLOW_EMPTY_MAP"), TEXT("path is empty"));
        return false;
    }
    if (bTravelInProgress || IsCurrentMap(MapPath))
    {
        ReportFlowFailure(TEXT("FLOW_DUPLICATE_TRAVEL"), MapPath);
        return false;
    }
    LastTravelRequest = MapPath;
    LastFlowError.Empty();
    bTravelInProgress = true;
    if (bTravelImmediately)
    {
        UGameplayStatics::OpenLevel(this, FName(*MapPath));
    }
    return true;
}

bool UBLAGameInstance::RequestStartMatch()
{
    return TravelTo(MatchMapPath);
}

bool UBLAGameInstance::RequestReturnToMenu()
{
    return TravelTo(MenuMapPath);
}
