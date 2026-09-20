#pragma once

#include "GameFramework/Actor.h"
#include "BLALanFlowTest.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLALanFlowTest : public AActor
{
    GENERATED_BODY()

public:
    ABLALanFlowTest();

    UFUNCTION(BlueprintCallable, Category = "BLA|Test")
    void RunAddressContracts();

    UFUNCTION(BlueprintCallable, Category = "BLA|Test")
    void RunWaitingContracts();

    UFUNCTION(BlueprintCallable, Category = "BLA|Test")
    void RunJoinAndTeamContracts();

    UFUNCTION(BlueprintCallable, Category = "BLA|Test")
    void RunStartContracts();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bTestFailed = false;

protected:
    virtual void BeginPlay() override;
};
