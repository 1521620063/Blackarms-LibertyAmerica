#pragma once
#include "GameFramework/Actor.h"
#include "BLAAITestFixture.generated.h"
UCLASS(Blueprintable)
class BLA_API ABLAAITestFixture : public AActor
{
    GENERATED_BODY()
public:
    ABLAAITestFixture();
protected:
    virtual void BeginPlay() override;
};
