#pragma once

#include "Components/ActorComponent.h"
#include "BLABotPerception.generated.h"

class ABLACharacterBase;

UENUM(BlueprintType)
enum class EBLA_StimulusType : uint8
{
    Sight,
    Hearing,
    Damage
};

UCLASS(Blueprintable, ClassGroup = "BLA", meta = (BlueprintSpawnableComponent))
class BLA_API UBLABotPerception : public UActorComponent
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    bool ReportStimulus(ABLACharacterBase* Observer, AActor* Source, EBLA_StimulusType Type, FVector StimulusLocation);

    UFUNCTION(BlueprintCallable, Category = "BLA|AI")
    void ForgetTarget();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    TObjectPtr<AActor> TargetActor;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    FVector LastKnownTargetLocation = FVector::ZeroVector;
    UPROPERTY(BlueprintReadOnly, Category = "BLA|AI")
    EBLA_StimulusType LastStimulusType = EBLA_StimulusType::Sight;
};
