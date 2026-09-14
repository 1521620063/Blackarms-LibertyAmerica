#pragma once

#include "Components/ActorComponent.h"
#include "BLAInteractionComponent.generated.h"

UCLASS(Blueprintable, ClassGroup = "BLA", meta = (BlueprintSpawnableComponent))
class BLA_API UBLAInteractionComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UBLAInteractionComponent();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Interaction", meta = (ClampMin = "0.0"))
    float InteractionRange = 250.0f;
};
