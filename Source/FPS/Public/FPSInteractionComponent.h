#pragma once

#include "Components/ActorComponent.h"
#include "FPSInteractionComponent.generated.h"

UCLASS(Blueprintable, ClassGroup = "FPS", meta = (BlueprintSpawnableComponent))
class FPS_API UFPSInteractionComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UFPSInteractionComponent();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Interaction", meta = (ClampMin = "0.0"))
    float InteractionRange = 250.0f;
};
