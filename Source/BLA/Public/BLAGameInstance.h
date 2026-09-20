#pragma once

#include "BLAGameplayTypes.h"
#include "Engine/GameInstance.h"
#include "Engine/EngineBaseTypes.h"
#include "TimerManager.h"
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

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Flow")
    bool bTravelInProgress = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Flow")
    FString LastFlowError;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Settings")
    FString SettingsSlotName = TEXT("BLAPlayerSettings");

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN|CommandLine")
    bool bLanHostRequested = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN|CommandLine")
    FString LanJoinAddress;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN|CommandLine")
    FString LanTeamName;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN|CommandLine")
    FString LanModeName;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN|CommandLine")
    int32 LanTeamSizeOverride = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN|CommandLine")
    float LanAutoStartSeconds = 0.0f;

    UFUNCTION(BlueprintCallable, Category = "BLA|Selection")
    void ApplyModeSelection(EBLA_MatchMode Mode);

    UFUNCTION(BlueprintCallable, Category = "BLA|Selection")
    bool ApplyTeamSize(int32 TeamSize);

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
    bool RequestStartMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    bool RequestHostLANMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    bool RequestJoinLANMatch(const FString& Address);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    bool RequestLeaveLAN();

    UFUNCTION(BlueprintCallable, Category = "BLA|Flow")
    bool RequestReturnToMenu();

    void ReportFlowFailure(const FString& Code, const FString& Details = FString());

    /** Test-harness configuration carried across the menu -> match -> menu travel (inert in Shipping). */
    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    bool bHarnessRequested = false;

    /**
     * Set by the Zero Facility soak driver. The in-level flow tests end rounds and travel between
     * maps, which corrupts an unattended AI observation run, so they stand down while this is set.
     */
    UPROPERTY(BlueprintReadWrite, Category = "BLA|Test")
    bool bSoakRequested = false;

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

protected:
    virtual void Init() override;
    virtual void Shutdown() override;
    virtual void OnWorldChanged(UWorld* OldWorld, UWorld* NewWorld) override;

private:
    bool IsCurrentMap(const FString& MapPath) const;
    void TickCommandLineLAN();
    void EnsureClientUIManager();
    void HandleNetworkFailure(UWorld* World, UNetDriver* NetDriver, ENetworkFailure::Type FailureType, const FString& ErrorString);

    FTimerHandle LanCommandLineTimer;
    bool bLanLaunchHandled = false;
    bool bLanTeamApplied = false;
    bool bLanLeaveRequested = false;
    bool bPackagedMenuLogged = false;
    int32 LanWorldTicks = 0;
};
