#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLAUIManager.generated.h"

class ABLAGameModeElimination;
class ABLAObjectiveManager;
class ABLARoundManager;
class ABLATeamOrderManager;
class UUserWidget;

UENUM(BlueprintType)
enum class EBLA_UIScreen : uint8
{
    None,
    MainMenu,
    ModeSelect,
    Settings,
    MatchHUD,
    RoundResult,
    MatchResult
};

/** Everything the HUD is allowed to show. Built only from GameState/PlayerState/components. */
USTRUCT(BlueprintType)
struct BLA_API FBLAMatchHUDState
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    float Health = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    float Armor = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    bool bAlive = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_DeathState DeathState = EBLA_DeathState::Alive;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 MagazineAmmo = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 ReserveAmmo = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_WeaponType WeaponType = EBLA_WeaponType::EnergyPistol;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_Team Team = EBLA_Team::Neutral;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 AttackersScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 DefendersScore = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 CurrentRound = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    float RoundTimeRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_RoundPhase RoundPhase = EBLA_RoundPhase::Loading;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_MatchMode MatchMode = EBLA_MatchMode::TeamElimination;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_ObjectiveState ObjectiveState = EBLA_ObjectiveState::None;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    float ObjectiveRemaining = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 LivingTeammates = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 LivingEnemies = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    EBLA_TeamOrder CurrentOrder = EBLA_TeamOrder::FollowPlayer;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 Kills = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    int32 Deaths = 0;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    float DamageDealt = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    float ObjectiveContribution = 0.0f;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|HUD")
    bool bCrosshairEnabled = true;
};

/**
 * Read-only view layer for Task 10. It reads GameInstance selections, GameState,
 * PlayerState, weapon/health/objective components and controller events; it never
 * decides a gameplay result. Level travel goes through UBLAGameInstance so the entry
 * flow has one owner.
 */
UCLASS(Blueprintable)
class BLA_API ABLAUIManager : public AActor
{
    GENERATED_BODY()

public:
    ABLAUIManager();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> MainMenuClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> ModeSelectClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> SettingsClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> MatchHUDClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> TeamStatusClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> WeaponStatusClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> ObjectiveStatusClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> RoundResultClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> MatchResultClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> InteractionPromptClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> CommandSelectorClass;
    UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "BLA|UI")
    TSubclassOf<UUserWidget> SpectatorClass;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|UI")
    bool bStartInMainMenu = true;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|UI")
    bool bCreateWidgets = true;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|UI")
    EBLA_UIScreen CurrentScreen = EBLA_UIScreen::None;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|UI")
    FBLAMatchHUDState HUDState;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|UI")
    EBLA_Team LastResultWinner = EBLA_Team::Neutral;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|UI")
    FName LastResultReason = NAME_None;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|UI")
    int32 HitFeedbackCount = 0;

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void Configure(ABLAGameModeElimination* InGameMode, ABLARoundManager* InRoundManager, ABLATeamOrderManager* InOrderManager);

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void SetObjectiveManager(ABLAObjectiveManager* InObjectiveManager);

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void ShowScreen(EBLA_UIScreen Screen);

    UFUNCTION(BlueprintPure, Category = "BLA|UI")
    EBLA_UIScreen GetCurrentScreen() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void OpenMainMenu();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void OpenModeSelect();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void OpenSettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void OpenMatchHUD();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void EvaluateMatchScreens();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void SelectMatchMode(EBLA_MatchMode Mode);

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void SelectTeamSize(int32 TeamSize);

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void SelectDifficulty(EBLA_DifficultyLevel Level);

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void StartMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void RestartMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void ReturnToMenu();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void ApplySettings(float MouseSensitivity, float FieldOfView, int32 ResolutionWidth, int32 ResolutionHeight,
        bool bFullscreen, float MasterVolume, float MusicVolume, float EffectsVolume, bool bSubtitles,
        bool bCrosshair, bool bColorAssistance);

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void SaveSettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void LoadSettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void RefreshHUD();

    UFUNCTION(BlueprintPure, Category = "BLA|UI")
    FBLAMatchHUDState GetHUDState() const;

    UFUNCTION(BlueprintPure, Category = "BLA|UI")
    ABLARoundManager* GetRoundManager() const;

    UFUNCTION(BlueprintPure, Category = "BLA|UI")
    ABLAObjectiveManager* GetObjectiveManager() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    void NotifyHitConfirmed(float AppliedDamage, bool bKilled);

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void HandleHitConfirmed(float AppliedDamage, bool bKilled);

    UUserWidget* CreateScreenWidget(EBLA_UIScreen Screen);
    void BindPlayerEvents();
    class UBLAGameInstance* GetBLAGameInstance() const;
    class ABLAGameState* GetMatchState() const;

    UPROPERTY()
    TObjectPtr<UUserWidget> ActiveWidget;

    UPROPERTY()
    TObjectPtr<ABLAGameModeElimination> MatchGameMode;

    UPROPERTY()
    TObjectPtr<ABLARoundManager> RoundManager;

    UPROPERTY()
    TObjectPtr<ABLAObjectiveManager> ObjectiveManager;

    UPROPERTY()
    TObjectPtr<ABLATeamOrderManager> TeamOrderManager;

    UPROPERTY()
    TObjectPtr<AActor> BoundFeedbackOwner;
};
