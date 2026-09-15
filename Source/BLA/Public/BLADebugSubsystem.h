#pragma once

#include "Subsystems/GameInstanceSubsystem.h"
#include "BLADebugSubsystem.generated.h"

/**
 * Collects the recovery/diagnostic events Task 12 requires (AI stuck recovery, core reset,
 * round watchdog, spawn fallback). Managers report into it, the test harness reads it.
 */
UCLASS(BlueprintType)
class BLA_API UBLADebugSubsystem : public UGameInstanceSubsystem
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadOnly, Category = "BLA|Debug")
    TArray<FString> EventLog;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Debug")
    TMap<FName, int32> EventCounts;

    UFUNCTION(BlueprintCallable, Category = "BLA|Debug")
    void ReportEvent(FName Event, const FString& Details);

    UFUNCTION(BlueprintPure, Category = "BLA|Debug")
    int32 GetEventCount(FName Event) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|Debug")
    void ClearLog();

    static UBLADebugSubsystem* Get(const UObject* WorldContextObject);
};
