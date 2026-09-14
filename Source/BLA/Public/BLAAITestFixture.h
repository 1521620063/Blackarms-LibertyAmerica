#pragma once
#include "GameFramework/Actor.h"
#include "BLAAITestFixture.generated.h"
UCLASS(Blueprintable)
class BLA_API ABLAAITestFixture : public AActor
{
    GENERATED_BODY()
public:
    ABLAAITestFixture();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bValidationSucceeded = false;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|Test")
    bool bValidationFailed = false;

protected:
    virtual void BeginPlay() override;
};
