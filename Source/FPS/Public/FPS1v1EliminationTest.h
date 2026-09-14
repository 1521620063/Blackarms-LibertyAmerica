#pragma once
#include "GameFramework/Actor.h"
#include "FPS1v1EliminationTest.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPS1v1EliminationTest : public AActor
{
    GENERATED_BODY()
public:
    AFPS1v1EliminationTest();
protected:
    virtual void BeginPlay() override;
};
