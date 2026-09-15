#include "BLAUIFlowTest.h"

#include "BLACharacterBase.h"
#include "BLAGameInstance.h"
#include "BLAGameState.h"
#include "BLARoundManager.h"
#include "BLASettingsSaveGame.h"
#include "BLAUIManager.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    constexpr int32 FlowTimeoutTicks = 900;
}

ABLAUIFlowTest::ABLAUIFlowTest()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLAUIFlowTest::BeginPlay()
{
    Super::BeginPlay();
}

bool ABLAUIFlowTest::Require(bool bCondition, const TCHAR* Reason)
{
    if (bCondition)
    {
        return true;
    }
    bTestFailed = true;
    FailureReason = Reason;
    UE_LOG(LogTemp, Error, TEXT("BLA_UIFLOW_FAILED flow=%s reason=%s"),
        Flow == EBLA_UIFlowKind::Menu ? TEXT("menu") : TEXT("match"), Reason);
    return false;
}

void ABLAUIFlowTest::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bFinished || bTestFailed)
    {
        return;
    }
    ++Ticks;

    ABLAUIManager* UIManager = Cast<ABLAUIManager>(
        UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    if (Flow == EBLA_UIFlowKind::Menu)
    {
        if (!UIManager)
        {
            if (Ticks >= FlowTimeoutTicks)
            {
                Require(false, TEXT("ui_manager_missing"));
                bFinished = true;
            }
            return;
        }
        RunMenuFlow();
        bFinished = true;
        return;
    }

    // The map's other functional tests may touch the shared game state in their first
    // frames, so "match ready" means the elimination game mode has configured the UI
    // manager with the live round manager, not a particular phase value.
    if (!UIManager || UIManager->GetRoundManager() == nullptr)
    {
        if (Ticks >= FlowTimeoutTicks)
        {
            Require(false, TEXT("match_not_ready"));
            bFinished = true;
        }
        return;
    }
    RunMatchFlow();
    bFinished = true;
}

void ABLAUIFlowTest::RunMenuFlow()
{
    ABLAUIManager* UIManager = Cast<ABLAUIManager>(
        UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    if (!Require(UIManager != nullptr && GameInstance != nullptr, TEXT("menu_context")))
    {
        return;
    }
    if (GameInstance->bHarnessRequested)
    {
        // The Task 12 harness owns the selection while it runs; the menu test steps aside.
        bTestSucceeded = true;
        UE_LOG(LogTemp, Display, TEXT("BLA_UIFLOW_OK flow=menu skipped_for_harness"));
        return;
    }
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MainMenu, TEXT("main_menu_initial")))
    {
        return;
    }

    UIManager->OpenModeSelect();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::ModeSelect, TEXT("mode_select_screen")))
    {
        return;
    }
    UIManager->SelectMatchMode(EBLA_MatchMode::DataCoreAttackDefense);
    UIManager->SelectTeamSize(3);
    UIManager->SelectDifficulty(EBLA_DifficultyLevel::Hard);
    if (!Require(GameInstance->SelectedMode == EBLA_MatchMode::DataCoreAttackDefense
        && GameInstance->SelectedTeamSize == 3
        && GameInstance->SelectedDifficultyLevel == EBLA_DifficultyLevel::Hard
        && GameInstance->SelectedRules != nullptr
        && GameInstance->SelectedRules->Rules.TeamSize == 3
        && GameInstance->SelectedDifficulty != nullptr,
        TEXT("selection_saved")))
    {
        return;
    }

    UIManager->OpenSettings();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::Settings, TEXT("settings_screen")))
    {
        return;
    }
    UIManager->ApplySettings(0.65f, 105.0f, 2560, 1440, false, 0.7f, 0.4f, 0.9f, false, false, true);
    UIManager->SaveSettings();
    UIManager->ApplySettings(1.0f, 90.0f, 1920, 1080, true, 1.0f, 1.0f, 1.0f, true, true, false);
    UIManager->LoadSettings();
    const UBLASettingsSaveGame* Settings = GameInstance->Settings;
    if (!Require(Settings != nullptr
        && FMath::IsNearlyEqual(Settings->MouseSensitivity, 0.65f)
        && FMath::IsNearlyEqual(Settings->FieldOfView, 105.0f)
        && Settings->ResolutionWidth == 2560
        && Settings->ResolutionHeight == 1440
        && !Settings->bFullscreen
        && FMath::IsNearlyEqual(Settings->MusicVolume, 0.4f)
        && !Settings->bSubtitles
        && !Settings->bCrosshair
        && Settings->bColorAssistance,
        TEXT("settings_round_trip")))
    {
        return;
    }
    GameInstance->ResetSettings();
    if (!Require(GameInstance->Settings != nullptr
        && FMath::IsNearlyEqual(GameInstance->Settings->MouseSensitivity, 1.0f)
        && GameInstance->Settings->bCrosshair,
        TEXT("settings_reset")))
    {
        return;
    }

    UIManager->OpenMainMenu();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MainMenu, TEXT("main_menu_return")))
    {
        return;
    }

    bTestSucceeded = true;
    // Level travel is left to the caller (the PIE driver calls ABLAUIManager::StartMatch),
    // so this actor stays side-effect free for every other driver that plays the menu map.
    UE_LOG(LogTemp, Display, TEXT("BLA_UIFLOW_OK flow=menu selections=1 settings=1 screens=3"));
}

void ABLAUIFlowTest::RunMatchFlow()
{
    ABLAUIManager* UIManager = Cast<ABLAUIManager>(
        UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    ABLARoundManager* RoundManager = UIManager ? UIManager->GetRoundManager() : nullptr;
    if (!UIManager || !GameInstance || !RoundManager)
    {
        const ABLAGameState* GameState = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
        const FString Reason = FString::Printf(TEXT("match_context ui=%d game_instance=%d round_manager=%d phase=%d"),
            UIManager != nullptr ? 1 : 0, GameInstance != nullptr ? 1 : 0, RoundManager != nullptr ? 1 : 0,
            GameState ? static_cast<int32>(GameState->RoundPhase) : -1);
        Require(false, *Reason);
        return;
    }
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MatchHUD, TEXT("match_hud_initial")))
    {
        return;
    }

    UIManager->RefreshHUD();
    const FBLAMatchHUDState HUD = UIManager->GetHUDState();
    const ABLACharacterBase* Player = Cast<ABLACharacterBase>(UGameplayStatics::GetPlayerPawn(this, 0));
    const bool bHudOk = Player != nullptr
        && HUD.bAlive
        && FMath::IsNearlyEqual(HUD.Health, 100.0f)
        && HUD.MagazineAmmo > 0
        && HUD.Team == EBLA_Team::Attackers
        && HUD.CurrentRound == 1
        && HUD.RoundPhase == EBLA_RoundPhase::Preparation
        && HUD.RoundTimeRemaining > 0.0f
        && HUD.MatchMode == EBLA_MatchMode::DataCoreAttackDefense
        && HUD.LivingEnemies >= 1
        && HUD.ObjectiveState == EBLA_ObjectiveState::Available
        && HUD.bCrosshairEnabled;
    if (!bHudOk)
    {
        const FString Reason = FString::Printf(
            TEXT("hud_refresh player=%d alive=%d health=%.1f ammo=%d reserve=%d team=%d round=%d phase=%d time=%.1f mode=%d enemies=%d objective=%d crosshair=%d"),
            Player != nullptr ? 1 : 0, HUD.bAlive ? 1 : 0, HUD.Health, HUD.MagazineAmmo, HUD.ReserveAmmo,
            static_cast<int32>(HUD.Team), HUD.CurrentRound, static_cast<int32>(HUD.RoundPhase),
            HUD.RoundTimeRemaining, static_cast<int32>(HUD.MatchMode), HUD.LivingEnemies,
            static_cast<int32>(HUD.ObjectiveState), HUD.bCrosshairEnabled ? 1 : 0);
        Require(false, *Reason);
        return;
    }

    if (!Require(RoundManager->EndRound(EBLA_Team::Defenders, TEXT("UIFlowTest")), TEXT("round_end_request")))
    {
        return;
    }
    UIManager->EvaluateMatchScreens();
    UIManager->RefreshHUD();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::RoundResult
        && UIManager->LastResultWinner == EBLA_Team::Defenders
        && UIManager->LastResultReason == FName(TEXT("UIFlowTest"))
        && UIManager->GetHUDState().DefendersScore == 1,
        TEXT("round_result_screen")))
    {
        return;
    }

    RoundManager->EndMatch(EBLA_Team::Attackers);
    UIManager->EvaluateMatchScreens();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MatchResult, TEXT("match_result_screen")))
    {
        return;
    }

    UIManager->RestartMatch();
    UIManager->RefreshHUD();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MatchHUD
        && UIManager->GetHUDState().RoundPhase == EBLA_RoundPhase::Preparation
        && UIManager->GetHUDState().AttackersScore == 0
        && UIManager->GetHUDState().DefendersScore == 0,
        TEXT("match_restart")))
    {
        return;
    }

    bTestSucceeded = true;
    // The return-to-menu travel is driven by the PIE driver through ABLAUIManager::
    // ReturnToMenu, so this actor never moves the other drivers' worlds.
    UE_LOG(LogTemp, Display, TEXT("BLA_UIFLOW_OK flow=match hud=1 round_result=1 match_result=1 restart=1"));
}
