#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/Actor.h"
#include "BLAAllMVPFlowsTest.generated.h"

/**
 * Task 12 flow test: runs one full match flow with the configuration the harness left in the
 * GameInstance - HUD read-back, forced damage, forced objective interaction, round result,
 * match result, restart and return to menu - and publishes pass/fail. The body is compiled out
 * of Shipping builds (it does nothing there) and it is only placed in development maps.
 */
UCLASS(Blueprintable)
class BLA_API ABLAAllMVPFlowsTest : public AActor
{
    GENERATED_BODY()

public:
    ABLAAllMVPFlowsTest();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestFailed = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    FString FailureReason;

private:
    bool Require(bool bCondition, const FString& Reason);
    void Run();
    void Report(FName Event, const FString& Details);

    int32 Ticks = 0;
    bool bFinished = false;
};
