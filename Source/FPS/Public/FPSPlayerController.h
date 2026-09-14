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

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnFireRequested();
    virtual void OnFireRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnReloadRequested();
    virtual void OnReloadRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnSwitchPrimaryRequested();
    virtual void OnSwitchPrimaryRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnSwitchSecondaryRequested();
    virtual void OnSwitchSecondaryRequested_Implementation();

    UFUNCTION(BlueprintImplementableEvent, Category = "FPS|Input")
    void OnCommandRequested();

private:
    void HandleMove(const FInputActionValue& Value);
    void HandleLook(const FInputActionValue& Value);
    void HandleJumpStarted();
    void HandleJumpCompleted();
    void BindInputActions();
};
