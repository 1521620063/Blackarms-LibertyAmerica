#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FPSGameplayDataValidator.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPSGameplayDataValidator : public AActor
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;

private:
    bool ValidateRuleAsset(const FString& AssetPath) const;
    bool ValidateDifficultyAsset(const FString& AssetPath) const;
};
