#pragma once

#include "Components/ActorComponent.h"
#include "FPSBotPerception.generated.h"

class AFPSCharacterBase;

UENUM(BlueprintType)
enum class EFPS_StimulusType : uint8
{
    Sight,
    Hearing,
    Damage
};

UCLASS(Blueprintable, ClassGroup = "FPS", meta = (BlueprintSpawnableComponent))
class FPS_API UFPSBotPerception : public UActorComponent
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    bool ReportStimulus(AFPSCharacterBase* Observer, AActor* Source, EFPS_StimulusType Type, FVector StimulusLocation);

    UFUNCTION(BlueprintCallable, Category = "FPS|AI")
    void ForgetTarget();

    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    TObjectPtr<AActor> TargetActor;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    FVector LastKnownTargetLocation = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category = "FPS|AI")
    EFPS_StimulusType LastStimulusType = EFPS_StimulusType::Sight;
};
