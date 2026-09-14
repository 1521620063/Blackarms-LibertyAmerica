#pragma once

#include "GameFramework/Actor.h"
#include "BLAMapNavigationTest.generated.h"

/**
 * Task 11 navigation functional test: route reachability, tactical point reachability,
 * no spawn-to-spawn sight line, valid objective interactions and no spawn overlap.
 */
UCLASS(Blueprintable)
class BLA_API ABLAMapNavigationTest : public AActor
{
    GENERATED_BODY()

public:
    ABLAMapNavigationTest();
    virtual void Tick(float DeltaSeconds) override;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestFailed = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    FString FailureReason;

protected:
    virtual void BeginPlay() override;

private:
    bool Require(bool bCondition, const FString& Reason);
    void RunChecks();
    bool HasPath(const FVector& From, const FVector& To);
    bool HasSpawnOverlap(const TArray<class ABLASpawnPoint*>& Spawns, const TCHAR* Reason);

    int32 Ticks = 0;
};
