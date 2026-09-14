#pragma once

#include "GameFramework/Actor.h"
#include "BLA3v3EliminationTest.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLA3v3EliminationTest : public AActor
{
    GENERATED_BODY()

public:
    ABLA3v3EliminationTest();

protected:
    virtual void BeginPlay() override;
};
