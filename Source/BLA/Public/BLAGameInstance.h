#pragma once

#include "BLAGameplayTypes.h"
#include "Engine/GameInstance.h"
#include "BLAGameInstance.generated.h"

class UBLABotDifficultyDataAsset;
class UBLAMatchRulesDataAsset;
class UBLASettingsSaveGame;

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

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Selection")
    EBLA_DifficultyLevel SelectedDifficultyLevel = EBLA_DifficultyLevel::Normal;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Settings")
    TObjectPtr<UBLASettingsSaveGame> Settings;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Flow")
    FString MenuMapPath = TEXT("/Game/BLA/Maps/Graybox/L_TestBootstrap");

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Flow")
    FString MatchMapPath = TEXT("/Game/BLA/Maps/Graybox/L_BLA_1v1_Elimination");

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Flow")
    FString LastTravelRequest;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Flow")
    bool bTravelImmediately = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Settings")
    FString SettingsSlotName = TEXT("BLAPlayerSettings");

    UFUNCTION(BlueprintCallable, Category = "BLA|Selection")
    void ApplyModeSelection(EBLA_MatchMode Mode);

    UFUNCTION(BlueprintCallable, Category = "BLA|Selection")
    void ApplyTeamSize(int32 TeamSize);

    UFUNCTION(BlueprintCallable, Category = "BLA|Selection")
    void ApplyDifficultyLevel(EBLA_DifficultyLevel Level);

    UFUNCTION(BlueprintCallable, Category = "BLA|Settings")
    void SaveSettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|Settings")
    void LoadSettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|Settings")
    void ResetSettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|Flow")
    bool TravelTo(const FString& MapPath);

    UFUNCTION(BlueprintCallable, Category = "BLA|Flow")
    void RequestStartMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|Flow")
    void RequestReturnToMenu();

    /** Test-harness configuration carried across the menu -> match -> menu travel (inert in Shipping). */
    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    bool bHarnessRequested = false;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    bool bHarnessRunAll = false;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    int32 HarnessConfigIndex = 0;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    EBLA_MatchMode HarnessMode = EBLA_MatchMode::TeamElimination;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    int32 HarnessTeamSize = 1;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    EBLA_DifficultyLevel HarnessDifficulty = EBLA_DifficultyLevel::Normal;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    FString HarnessResult;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    TArray<FString> HarnessResults;
};
