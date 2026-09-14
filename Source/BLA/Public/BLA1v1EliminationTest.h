#pragma once
#include "GameFramework/Actor.h"
#include "BLA1v1EliminationTest.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLA1v1EliminationTest : public AActor
{
    GENERATED_BODY()
public:
    ABLA1v1EliminationTest();
protected:
    virtual void BeginPlay() override;
};
