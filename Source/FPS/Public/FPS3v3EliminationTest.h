#pragma once

#include "GameFramework/Actor.h"
#include "FPS3v3EliminationTest.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPS3v3EliminationTest : public AActor
{
    GENERATED_BODY()

public:
    AFPS3v3EliminationTest();

protected:
    virtual void BeginPlay() override;
};
