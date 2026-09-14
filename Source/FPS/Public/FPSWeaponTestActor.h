#pragma once

#include "GameFramework/Actor.h"
#include "FPSWeaponTestActor.generated.h"

class AFPSPlayerCharacter;
class UFPSWeaponDataAsset;

UCLASS(Blueprintable)
class FPS_API AFPSWeaponTestActor : public AActor
{
    GENERATED_BODY()

public:
    AFPSWeaponTestActor();
    virtual void Tick(float DeltaSeconds) override;

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void HandleHitFeedback(float AppliedDamage, bool bKilled);

    void Fail(const TCHAR* Reason);

    UPROPERTY()
    TObjectPtr<AFPSPlayerCharacter> Shooter;

    UPROPERTY()
    TObjectPtr<AFPSPlayerCharacter> Target;

    UPROPERTY()
    TObjectPtr<UFPSWeaponDataAsset> PrimaryData;

    UPROPERTY()
    TObjectPtr<UFPSWeaponDataAsset> SecondaryData;

    UPROPERTY()
    TObjectPtr<UFPSWeaponDataAsset> TertiaryData;

    float ElapsedSeconds = 0.0f;
    int32 Stage = 0;
    int32 FeedbackCount = 0;
    bool bFinished = false;
};
