#pragma once

#include "GameFramework/Actor.h"
#include "FPSDataCoreTest.generated.h"

/**
 * Functional test for the Data Core objective state machine. It spawns its own
 * isolated managers, rules, and combatants so its assertions cannot race the
 * level's own actors, and reports exactly one FPS_DATACORE_OK / _FAILED line.
 */
UCLASS(Blueprintable)
class FPS_API AFPSDataCoreTest : public AActor
{
    GENERATED_BODY()

public:
    AFPSDataCoreTest();

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Test")
    bool bTestSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Test")
    bool bTestFailed = false;

    UPROPERTY(BlueprintReadOnly, Category = "FPS|Test")
    FName FailureReason;

protected:
    virtual void BeginPlay() override;

private:
    bool Require(bool bCondition, const TCHAR* Reason);
};
