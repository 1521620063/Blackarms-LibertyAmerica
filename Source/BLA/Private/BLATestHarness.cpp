#include "BLATestHarness.h"

#if !UE_BUILD_SHIPPING

#include "BLADebugSubsystem.h"
#include "BLAGameInstance.h"
#include "BLAUIManager.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    void DecodeHarnessConfiguration(int32 Index, EBLA_MatchMode& OutMode, int32& OutTeamSize, EBLA_DifficultyLevel& OutDifficulty)
    {
        OutMode = (Index / 9) == 0 ? EBLA_MatchMode::TeamElimination : EBLA_MatchMode::DataCoreAttackDefense;
        OutTeamSize = ((Index / 3) % 3) + 1;
        OutDifficulty = static_cast<EBLA_DifficultyLevel>(Index % 3);
    }
}

ABLATestHarness::ABLATestHarness()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLATestHarness::BeginPlay()
{
    Super::BeginPlay();
    // Only the first menu-map load starts the run: travel reloads this map for every result.
    const UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    const bool bFirstEntry = GameInstance && !GameInstance->bHarnessRunAll
        && GameInstance->HarnessResults.Num() == 0 && !GameInstance->bHarnessRequested;
    if (bFirstEntry && FParse::Param(FCommandLine::Get(), TEXT("BLASmokeTest")))
    {
        RunAllConfigurations();
    }
}

void ABLATestHarness::RunConfiguration(EBLA_MatchMode Mode, int32 TeamSize, EBLA_DifficultyLevel Difficulty)
{
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    if (!GameInstance)
    {
        return;
    }
    GameInstance->bHarnessRunAll = false;
    GameInstance->HarnessMode = Mode;
    GameInstance->HarnessTeamSize = FMath::Clamp(TeamSize, 1, 3);
    GameInstance->HarnessDifficulty = Difficulty;
    GameInstance->HarnessResult.Reset();
    GameInstance->HarnessResults.Reset();
    GameInstance->bHarnessRequested = true;
    StartRequestedConfiguration();
}

void ABLATestHarness::RunAllConfigurations()
{
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    if (!GameInstance)
    {
        return;
    }
    GameInstance->bHarnessRunAll = true;
    GameInstance->HarnessConfigIndex = 0;
    GameInstance->HarnessResult.Reset();
    GameInstance->HarnessResults.Reset();
    DecodeHarnessConfiguration(0, GameInstance->HarnessMode, GameInstance->HarnessTeamSize, GameInstance->HarnessDifficulty);
    GameInstance->bHarnessRequested = true;
    StartRequestedConfiguration();
}

void ABLATestHarness::StartRequestedConfiguration()
{
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    ABLAUIManager* UIManager = Cast<ABLAUIManager>(
        UGameplayStatics::GetActorOfClass(this, ABLAUIManager::StaticClass()));
    if (!GameInstance || !UIManager)
    {
        return;
    }
    UIManager->SelectMatchMode(GameInstance->HarnessMode);
    UIManager->SelectTeamSize(GameInstance->HarnessTeamSize);
    UIManager->SelectDifficulty(GameInstance->HarnessDifficulty);
    GameInstance->MatchMapPath = TargetMapPath;
    if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
    {
        Debug->ReportEvent(TEXT("HARNESS_CONFIGURATION_STARTED"),
            FString::Printf(TEXT("mode=%d size=%d difficulty=%d"),
                static_cast<int32>(GameInstance->HarnessMode), GameInstance->HarnessTeamSize,
                static_cast<int32>(GameInstance->HarnessDifficulty)));
    }
    UIManager->StartMatch();
}

void ABLATestHarness::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    if (!GameInstance)
    {
        return;
    }
    if (!bStarted && GameInstance->bHarnessRequested)
    {
        bStarted = true;
        StartRequestedConfiguration();
        return;
    }
    if (GameInstance->bHarnessRequested)
    {
        // Waiting for the match map's flow test to come back.
        if (++Ticks >= 1800)
        {
            GameInstance->HarnessResult = TEXT("FAILED harness_timeout");
            GameInstance->bHarnessRequested = false;
        }
        return;
    }
    if (!bHasResult && !GameInstance->HarnessResult.IsEmpty())
    {
        LastResult = GameInstance->HarnessResult;
        bHasResult = true;
        Results.Add(LastResult);
        if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
        {
            FlowsEventCount = Debug->GetEventCount(TEXT("ALL_MVP_FLOWS_OK"));
            Debug->ReportEvent(TEXT("HARNESS_CONFIGURATION_RESULT"), LastResult);
        }
        ContinueOrPublish();
    }
}

void ABLATestHarness::ContinueOrPublish()
{
    UBLAGameInstance* GameInstance = GetWorld()->GetGameInstance<UBLAGameInstance>();
    if (!GameInstance || !GameInstance->bHarnessRunAll)
    {
        return;
    }
    GameInstance->HarnessResults.Add(LastResult);
    ++GameInstance->HarnessConfigIndex;
    if (GameInstance->HarnessConfigIndex >= ConfigurationCount)
    {
        GameInstance->bHarnessRunAll = false;
        int32 Failures = 0;
        for (const FString& Entry : GameInstance->HarnessResults)
        {
            Failures += Entry.StartsWith(TEXT("OK")) ? 0 : 1;
        }
        if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
        {
            Debug->ReportEvent(TEXT("HARNESS_RUN_COMPLETE"),
                FString::Printf(TEXT("configurations=%d failures=%d"), GameInstance->HarnessResults.Num(), Failures));
        }
        if (FParse::Param(FCommandLine::Get(), TEXT("BLASmokeTest")))
        {
            FGenericPlatformMisc::RequestExit(false);
        }
        return;
    }
    DecodeHarnessConfiguration(GameInstance->HarnessConfigIndex, GameInstance->HarnessMode,
        GameInstance->HarnessTeamSize, GameInstance->HarnessDifficulty);
    GameInstance->HarnessResult.Reset();
    GameInstance->bHarnessRequested = true;
    StartRequestedConfiguration();
}

#else

ABLATestHarness::ABLATestHarness()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ABLATestHarness::RunConfiguration(EBLA_MatchMode Mode, int32 TeamSize, EBLA_DifficultyLevel Difficulty)
{
}

void ABLATestHarness::RunAllConfigurations()
{
}

void ABLATestHarness::StartRequestedConfiguration()
{
}

void ABLATestHarness::ContinueOrPublish()
{
}

void ABLATestHarness::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
}

#endif
