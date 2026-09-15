#pragma once

#include "GameFramework/Actor.h"
#include "BLAUIFlowTest.generated.h"

UENUM(BlueprintType)
enum class EBLA_UIFlowKind : uint8
{
    Menu,
    Match
};

/**
 * Functional test for the Task 10 player flow. One instance lives on the menu map
 * (selections, settings round-trip, empty map / invalid size / duplicate start) and one
 * on the match map (HUD refresh, round/match result screens, restart, results-to-menu).
 */
UCLASS(Blueprintable)
class BLA_API ABLAUIFlowTest : public AActor
{
    GENERATED_BODY()

public:
    ABLAUIFlowTest();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "BLA|Test")
    EBLA_UIFlowKind Flow = EBLA_UIFlowKind::Menu;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestFailed = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    FString FailureReason;

protected:
    virtual void BeginPlay() override;

private:
    bool Require(bool bCondition, const TCHAR* Reason);
    void RunMenuFlow();
    void RunMatchFlow();

    bool bFinished = false;
    int32 Ticks = 0;
};
