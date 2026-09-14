#pragma once

#include "GameFramework/Actor.h"
#include "BLAWeaponTestActor.generated.h"

class ABLAPlayerCharacter;
class UBLAWeaponDataAsset;

UCLASS(Blueprintable)
class BLA_API ABLAWeaponTestActor : public AActor
{
    GENERATED_BODY()

public:
    ABLAWeaponTestActor();
    virtual void Tick(float DeltaSeconds) override;

protected:
    virtual void BeginPlay() override;

private:
    UFUNCTION()
    void HandleHitFeedback(float AppliedDamage, bool bKilled);

    void Fail(const TCHAR* Reason);

    UPROPERTY()
    TObjectPtr<ABLAPlayerCharacter> Shooter;

    UPROPERTY()
    TObjectPtr<ABLAPlayerCharacter> Target;

    UPROPERTY()
    TObjectPtr<UBLAWeaponDataAsset> PrimaryData;

    UPROPERTY()
    TObjectPtr<UBLAWeaponDataAsset> SecondaryData;

    UPROPERTY()
    TObjectPtr<UBLAWeaponDataAsset> TertiaryData;

    float ElapsedSeconds = 0.0f;
    int32 Stage = 0;
    int32 FeedbackCount = 0;
    bool bFinished = false;
};
