#include "BLAAllMVPFlowsTest.h"

#if !UE_BUILD_SHIPPING

#include "BLACharacterBase.h"
#include "BLADataCore.h"
#include "BLADebugSubsystem.h"
#include "BLAGameInstance.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLAObjectiveManager.h"
#include "BLAObjectiveZone.h"
#include "BLARoundManager.h"
#include "BLATeamManager.h"
#include "BLAUIManager.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"
#include "Misc/CommandLine.h"

namespace
{
    constexpr int32 AllMVPFlowTimeoutTicks = 1200;
}

ABLAAllMVPFlowsTest::ABLAAllMVPFlowsTest()
{
    PrimaryActorTick.bCanEverTick = true;
}

bool ABLAAllMVPFlowsTest::Require(bool bCondition, const FString& Reason)
{
    if (bCondition)
    {
        return true;
    }
    bTestFailed = true;
    FailureReason = Reason;
    UE_LOG(LogTemp, Error, TEXT("BLA_ALL_MVP_FLOWS_FAILED reason=%s"), *Reason);
    return false;
}

void ABLAAllMVPFlowsTest::Report(FName Event, const FString& Details)
{
    if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
    {
        Debug->ReportEvent(Event, Details);
    }
}

void ABLAAllMVPFlowsTest::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bFinished || bTestFailed)
    {
        return;
    }
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    if (FParse::Param(FCommandLine::Get(), TEXT("BLASoakTest"))
        || (GameInstance && GameInstance->bSoakRequested))
    {
        // The soak drives a live match for AI observation; this flow test forces damage, ends
        // matches and travels, so it stays out of the way and reports a neutral marker.
        bFinished = true;
        UE_LOG(LogTemp, Display, TEXT("BLA_ALL_MVP_FLOWS_SKIPPED reason=soak"));
        return;
    }
    ABLAUIManager* UIManager = Cast<ABLAUIManager>(
        UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    if (!GameInstance || !GameInstance->bHarnessRequested || !UIManager || !UIManager->GetRoundManager())
    {
        if (++Ticks >= AllMVPFlowTimeoutTicks)
        {
            Require(false, TEXT("match_not_ready"));
            if (GameInstance)
            {
                GameInstance->HarnessResult = TEXT("FAILED match_not_ready");
                GameInstance->bHarnessRequested = false;
            }
            if (ABLAUIManager* TimeoutUIManager = Cast<ABLAUIManager>(
                UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass())))
            {
                TimeoutUIManager->ReturnToMenu();
            }
        }
        return;
    }
    bFinished = true;
    Run();
}

void ABLAAllMVPFlowsTest::Run()
{
    UBLAGameInstance* GameInstance = GetWorld()->GetGameInstance<UBLAGameInstance>();
    ABLAUIManager* UIManager = Cast<ABLAUIManager>(
        UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    ABLARoundManager* RoundManager = UIManager ? UIManager->GetRoundManager() : nullptr;
    ABLATeamManager* Teams = RoundManager ? RoundManager->TeamManager : nullptr;
    ABLACharacterBase* Player = Cast<ABLACharacterBase>(UGameplayStatics::GetPlayerPawn(this, 0));
    const FString Context = FString::Printf(TEXT("mode=%d size=%d difficulty=%d"),
        static_cast<int32>(GameInstance->HarnessMode), GameInstance->HarnessTeamSize,
        static_cast<int32>(GameInstance->HarnessDifficulty));
    const auto Finish = [this, GameInstance, UIManager](const FString& Result)
    {
        GameInstance->HarnessResult = Result;
        GameInstance->bHarnessRequested = false;
        // Always travel back so the harness can read the result and continue.
        if (UIManager)
        {
            UIManager->ReturnToMenu();
        }
    };

    if (!Require(GameInstance->SelectedMode == GameInstance->HarnessMode
        && GameInstance->SelectedTeamSize == GameInstance->HarnessTeamSize
        && GameInstance->SelectedDifficultyLevel == GameInstance->HarnessDifficulty
        && GameInstance->SelectedDifficulty != nullptr, TEXT("selection_applied")))
    {
        Finish(FString::Printf(TEXT("FAILED selection_applied %s"), *Context));
        return;
    }

    UIManager->RefreshHUD();
    const FBLAMatchHUDState HUD = UIManager->GetHUDState();
    if (!Require(Player != nullptr && HUD.bAlive && HUD.Health > 0.0f && HUD.MagazineAmmo > 0
        && HUD.Team == EBLA_Team::Attackers && HUD.LivingEnemies >= 1
        && HUD.MatchMode == GameInstance->HarnessMode, TEXT("hud_readback")))
    {
        Finish(FString::Printf(TEXT("FAILED hud_readback %s"), *Context));
        return;
    }

    // Forced damage: kill one enemy through the health component only.
    if (Teams)
    {
        const TArray<ABLACharacterBase*> Enemies = Teams->GetTeamMembers(EBLA_Team::Defenders);
        if (!Require(Enemies.Num() > 0 && Enemies[0]->HealthComponent, TEXT("enemy_missing")))
        {
            Finish(FString::Printf(TEXT("FAILED enemy_missing %s"), *Context));
            return;
        }
        const int32 LivingBefore = Teams->GetLivingCount(EBLA_Team::Defenders);
        Enemies[0]->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Player);
        if (!Require(Enemies[0]->HealthComponent->bIsDead
            && Teams->GetLivingCount(EBLA_Team::Defenders) == LivingBefore - 1, TEXT("forced_damage")))
        {
            Finish(FString::Printf(TEXT("FAILED forced_damage %s"), *Context));
            return;
        }
        Report(TEXT("FORCED_DAMAGE_APPLIED"), FString::Printf(TEXT("target=%s %s"), *Enemies[0]->GetName(), *Context));
    }

    // Forced objective interaction in Data Core mode.
    if (GameInstance->HarnessMode == EBLA_MatchMode::DataCoreAttackDefense)
    {
        ABLAObjectiveManager* Objective = UIManager->GetObjectiveManager();
        if (!Require(Objective && Objective->DataCore && Objective->ObjectiveZone, TEXT("objective_missing")))
        {
            Finish(FString::Printf(TEXT("FAILED objective_missing %s"), *Context));
            return;
        }
        RoundManager->StartCombatPhase();
        // Freeze the pawn for the forced interaction: the objective manager cancels on
        // movement, and a teleported character would otherwise fall out of tolerance.
        UCharacterMovementComponent* Movement = Player->GetCharacterMovement();
        if (Movement)
        {
            Movement->DisableMovement();
        }
        Player->SetActorLocation(Objective->DataCore->GetActorLocation() + FVector(100.0f, 0.0f, 0.0f));
        if (!Require(Objective->BeginPickup(Player) && Objective->ObjectiveState == EBLA_ObjectiveState::Carried,
            TEXT("forced_pickup")))
        {
            Finish(FString::Printf(TEXT("FAILED forced_pickup %s"), *Context));
            return;
        }
        Player->SetActorLocation(Objective->ObjectiveZone->GetActorLocation());
        if (!Require(Objective->BeginPlant(Player) && Objective->ObjectiveState == EBLA_ObjectiveState::Planting,
            TEXT("forced_plant")))
        {
            Finish(FString::Printf(TEXT("FAILED forced_plant %s"), *Context));
            return;
        }
        const FBLAMatchRules ActiveRules = RoundManager->GetActiveRules();
        Objective->Tick(ActiveRules.PlantSeconds + 0.5f);
        if (!Require(Objective->ObjectiveState == EBLA_ObjectiveState::Planted, TEXT("forced_plant_complete")))
        {
            Finish(FString::Printf(
                TEXT("FAILED forced_plant_complete state=%d cancel=%s remaining=%.2f plant_seconds=%.2f ")
                TEXT("alive=%d in_zone=%d core_in_zone=%d interacting=%d health=%.1f player=%s zone=%s core=%s %s"),
                static_cast<int32>(Objective->ObjectiveState), *Objective->LastCancelReason.ToString(),
                Objective->InteractionRemaining, ActiveRules.PlantSeconds,
                Player->GetIsAlive() ? 1 : 0,
                Objective->ObjectiveZone->ContainsActor(Player) ? 1 : 0,
                Objective->ObjectiveZone->ContainsLocation(Objective->DataCore->GetActorLocation()) ? 1 : 0,
                Objective->IsInteractionActive() ? 1 : 0,
                Player->HealthComponent ? Player->HealthComponent->CurrentHealth : -1.0f,
                *Player->GetActorLocation().ToCompactString(),
                *Objective->ObjectiveZone->GetActorLocation().ToCompactString(),
                *Objective->DataCore->GetActorLocation().ToCompactString(), *Context));
            return;
        }
        Objective->Tick(0.1f);
        if (!Require(Objective->ObjectiveState == EBLA_ObjectiveState::Uploading, TEXT("forced_upload_started")))
        {
            Finish(FString::Printf(TEXT("FAILED forced_upload_started state=%d remaining=%.2f %s"),
                static_cast<int32>(Objective->ObjectiveState), Objective->UploadRemaining, *Context));
            return;
        }
        Objective->Tick(ActiveRules.UploadSeconds + 1.0f);
        if (!Require(Objective->ObjectiveState == EBLA_ObjectiveState::Completed
            && RoundManager->LastResult
            && RoundManager->LastResult->Reason == FName(TEXT("ObjectiveUploaded")),
            TEXT("forced_upload_complete")))
        {
            Finish(FString::Printf(TEXT("FAILED forced_upload_complete state=%d reason=%s remaining=%.2f upload_seconds=%.2f %s"),
                static_cast<int32>(Objective->ObjectiveState),
                RoundManager->LastResult ? *RoundManager->LastResult->Reason.ToString() : TEXT("none"),
                Objective->UploadRemaining, ActiveRules.UploadSeconds, *Context));
            return;
        }
        if (!Require(RoundManager->EndRound(EBLA_Team::Attackers, TEXT("AllMVPFlows")) == false,
            TEXT("forced_no_duplicate_score")))
        {
            Finish(FString::Printf(TEXT("FAILED forced_no_duplicate_score %s"), *Context));
            return;
        }
        Report(TEXT("FORCED_OBJECTIVE_ACTION"), FString::Printf(TEXT("pickup=1 plant=1 upload=1 %s"), *Context));
        if (Movement)
        {
            Movement->SetMovementMode(MOVE_Walking);
        }
    }

    // Round result, match result, restart and the return-to-menu request.
    const FName ExpectedRoundReason = GameInstance->HarnessMode == EBLA_MatchMode::DataCoreAttackDefense
        ? FName(TEXT("ObjectiveUploaded"))
        : FName(TEXT("AllMVPFlows"));
    if (GameInstance->HarnessMode != EBLA_MatchMode::DataCoreAttackDefense)
    {
        if (!Require(RoundManager->EndRound(EBLA_Team::Attackers, TEXT("AllMVPFlows")), TEXT("round_end")))
        {
            Finish(FString::Printf(TEXT("FAILED round_end %s"), *Context));
            return;
        }
    }
    UIManager->EvaluateMatchScreens();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::RoundResult
        && UIManager->LastResultReason == ExpectedRoundReason, TEXT("round_result_screen")))
    {
        Finish(FString::Printf(TEXT("FAILED round_result_screen reason=%s expected=%s %s"),
            *UIManager->LastResultReason.ToString(), *ExpectedRoundReason.ToString(), *Context));
        return;
    }
    RoundManager->EndMatch(EBLA_Team::Attackers);
    UIManager->EvaluateMatchScreens();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MatchResult, TEXT("match_result_screen")))
    {
        Finish(FString::Printf(TEXT("FAILED match_result_screen %s"), *Context));
        return;
    }
    UIManager->RestartMatch();
    UIManager->RefreshHUD();
    if (!Require(UIManager->GetCurrentScreen() == EBLA_UIScreen::MatchHUD
        && UIManager->GetHUDState().RoundPhase == EBLA_RoundPhase::Preparation
        && UIManager->GetHUDState().AttackersScore == 0, TEXT("restart")))
    {
        Finish(FString::Printf(TEXT("FAILED restart %s"), *Context));
        return;
    }

    bTestSucceeded = true;
    Finish(FString::Printf(TEXT("OK %s"), *Context));
    Report(TEXT("ALL_MVP_FLOWS_OK"), Context);
}

#else

ABLAAllMVPFlowsTest::ABLAAllMVPFlowsTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

bool ABLAAllMVPFlowsTest::Require(bool bCondition, const FString& Reason)
{
    return false;
}

void ABLAAllMVPFlowsTest::Run()
{
}

void ABLAAllMVPFlowsTest::Report(FName Event, const FString& Details)
{
}

void ABLAAllMVPFlowsTest::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
}

#endif
