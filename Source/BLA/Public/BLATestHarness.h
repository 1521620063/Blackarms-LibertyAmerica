#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLATestHarness.generated.h"

/**
 * Task 12 test harness. It lives on the menu map, selects mode/scale/difficulty/map for the
 * flow test, starts the match, waits for the flow test to come back through the menu and
 * reports pass/fail per configuration. The body is compiled out of Shipping builds.
 */
UCLASS(Blueprintable)
class BLA_API ABLATestHarness : public AActor
{
    GENERATED_BODY()

public:
    ABLATestHarness();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bHasResult = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    FString LastResult;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    TArray<FString> Results;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    int32 FlowsEventCount = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Test")
    FString TargetMapPath = TEXT("/Game/BLA/Maps/Final/L_BLA_ZeroFacility");

    UFUNCTION(BlueprintCallable, Category = "BLA|Test")
    void RunConfiguration(EBLA_MatchMode Mode, int32 TeamSize, EBLA_DifficultyLevel Difficulty);

    UFUNCTION(BlueprintCallable, Category = "BLA|Test")
    void RunAllConfigurations();

protected:
    virtual void BeginPlay() override;

private:
    void StartRequestedConfiguration();
    void ContinueOrPublish();

    static constexpr int32 ConfigurationCount = 18;
    int32 Ticks = 0;
    bool bStarted = false;
};
