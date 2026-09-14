#pragma once

#include "GameFramework/GameModeBase.h"
#include "BLAGameMode.generated.h"

class ABLAUIManager;

UCLASS(Blueprintable)
class BLA_API ABLAGameMode : public AGameModeBase
{
    GENERATED_BODY()

public:
    ABLAGameMode();

    UPROPERTY(BlueprintReadOnly, Category = "BLA|UI")
    TObjectPtr<ABLAUIManager> UIManager;

    UFUNCTION(BlueprintCallable, Category = "BLA|UI")
    ABLAUIManager* SpawnUIManager();

protected:
    virtual void BeginPlay() override;
    /** Match maps start on the HUD; the default (menu) map starts on the main menu. */
    virtual bool ShouldStartInMainMenu() const { return true; }
};
