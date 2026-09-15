#pragma once

#include "GameFramework/Actor.h"
#include "BLADataCoreTest.generated.h"

/**
 * Functional test for the Data Core objective state machine. It spawns its own
 * isolated managers, rules, and combatants so its assertions cannot race the
 * level's own actors, and reports exactly one BLA_DATACORE_OK / _FAILED line.
 */
UCLASS(Blueprintable)
class BLA_API ABLADataCoreTest : public AActor
{
    GENERATED_BODY()

public:
    ABLADataCoreTest();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestFailed = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    FName FailureReason;

protected:
    virtual void BeginPlay() override;

private:
    bool Require(bool bCondition, const TCHAR* Reason);
    bool RunPacingChecks();
};
