#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "BLAGameplayDataValidator.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLAGameplayDataValidator : public AActor
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;

private:
    bool ValidateRuleAsset(const FString& AssetPath) const;
    bool ValidateDifficultyAsset(const FString& AssetPath) const;
};
