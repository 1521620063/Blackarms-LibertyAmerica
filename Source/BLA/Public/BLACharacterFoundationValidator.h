#pragma once

#include "GameFramework/Actor.h"
#include "BLACharacterFoundationValidator.generated.h"

class ABLAPlayerCharacter;

UCLASS(Blueprintable)
class BLA_API ABLACharacterFoundationValidator : public AActor
{
    GENERATED_BODY()

public:
    ABLACharacterFoundationValidator();
    virtual void Tick(float DeltaSeconds) override;

protected:
    virtual void BeginPlay() override;

private:
    void Fail(const TCHAR* Reason);
    void HandleDeath(AActor* InstigatorActor);

    UPROPERTY()
    TObjectPtr<ABLAPlayerCharacter> TestCharacter;

    FVector MovementStart = FVector::ZeroVector;
    float MaximumJumpZ = 0.0f;
    float InitialYaw = 0.0f;
    int32 TickCount = 0;
    int32 DeathEventCount = 0;
    bool bFinished = false;
};
