#pragma once
#include "GameFramework/Actor.h"
#include "FPSAITestFixture.generated.h"
UCLASS(Blueprintable)
class FPS_API AFPSAITestFixture : public AActor
{
    GENERATED_BODY()
public:
    AFPSAITestFixture();
protected:
    virtual void BeginPlay() override;
};
