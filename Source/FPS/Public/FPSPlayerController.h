#pragma once

#include "GameFramework/PlayerController.h"
#include "InputActionValue.h"
#include "FPSPlayerController.generated.h"

UCLASS(Blueprintable)
class FPS_API AFPSPlayerController : public APlayerController
{
    GENERATED_BODY()

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;

    UFUNCTION(BlueprintImplementableEvent, Category = "FPS|Input")
    void OnFireRequested();

    UFUNCTION(BlueprintImplementableEvent, Category = "FPS|Input")
    void OnReloadRequested();

    UFUNCTION(BlueprintImplementableEvent, Category = "FPS|Input")
    void OnSwitchPrimaryRequested();

    UFUNCTION(BlueprintImplementableEvent, Category = "FPS|Input")
    void OnSwitchSecondaryRequested();

    UFUNCTION(BlueprintImplementableEvent, Category = "FPS|Input")
    void OnCommandRequested();

private:
    void HandleMove(const FInputActionValue& Value);
    void HandleLook(const FInputActionValue& Value);
    void HandleJumpStarted();
    void HandleJumpCompleted();
    void BindInputActions();
};
