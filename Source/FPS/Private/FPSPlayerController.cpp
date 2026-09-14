#include "FPSPlayerController.h"

#include "Camera/CameraComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "FPSCharacterBase.h"
#include "FPSWeaponComponent.h"
#include "InputAction.h"
#include "InputMappingContext.h"

namespace
{
    const TCHAR* InputRoot = TEXT("/Game/FPS/Blueprints/Characters/Input/");

    template <typename T>
    T* LoadInputAsset(const TCHAR* Name)
    {
        const FString Path = FString::Printf(TEXT("%s%s.%s"), InputRoot, Name, Name);
        return LoadObject<T>(nullptr, *Path);
    }
}

void AFPSPlayerController::BeginPlay()
{
    Super::BeginPlay();

    if (ULocalPlayer* LocalPlayer = GetLocalPlayer())
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem = LocalPlayer->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
        {
            if (UInputMappingContext* Context = LoadInputAsset<UInputMappingContext>(TEXT("IMC_FPSPlayer")))
            {
                Subsystem->AddMappingContext(Context, 0);
            }
        }
    }
}

void AFPSPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    BindInputActions();
}

void AFPSPlayerController::BindInputActions()
{
    UEnhancedInputComponent* Enhanced = Cast<UEnhancedInputComponent>(InputComponent);
    if (!Enhanced)
    {
        return;
    }

    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Move")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Triggered, this, &AFPSPlayerController::HandleMove);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Look")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Triggered, this, &AFPSPlayerController::HandleLook);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Jump")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &AFPSPlayerController::HandleJumpStarted);
        Enhanced->BindAction(Action, ETriggerEvent::Completed, this, &AFPSPlayerController::HandleJumpCompleted);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Fire")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &AFPSPlayerController::OnFireRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Reload")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &AFPSPlayerController::OnReloadRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_SwitchPrimary")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &AFPSPlayerController::OnSwitchPrimaryRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_SwitchSecondary")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &AFPSPlayerController::OnSwitchSecondaryRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Command")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &AFPSPlayerController::OnCommandRequested);
    }
}

void AFPSPlayerController::HandleMove(const FInputActionValue& Value)
{
    AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn());
    if (!FPSCharacter || !FPSCharacter->GetIsAlive())
    {
        return;
    }

    const FVector2D Movement = Value.Get<FVector2D>();
    const FRotator YawRotation(0.0f, GetControlRotation().Yaw, 0.0f);
    FPSCharacter->AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Movement.Y);
    FPSCharacter->AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Movement.X);
}

void AFPSPlayerController::HandleLook(const FInputActionValue& Value)
{
    const FVector2D Look = Value.Get<FVector2D>();
    AddYawInput(Look.X);
    AddPitchInput(Look.Y);
}

void AFPSPlayerController::HandleJumpStarted()
{
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->GetIsAlive())
    {
        FPSCharacter->Jump();
    }
}

void AFPSPlayerController::HandleJumpCompleted()
{
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()))
    {
        FPSCharacter->StopJumping();
    }
}

void AFPSPlayerController::OnFireRequested_Implementation()
{
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->FirstPersonCamera && FPSCharacter->WeaponComponent)
    {
        FPSCharacter->WeaponComponent->FireWeapon(FPSCharacter->FirstPersonCamera->GetComponentLocation(), FPSCharacter->FirstPersonCamera->GetForwardVector());
    }
}

void AFPSPlayerController::OnReloadRequested_Implementation()
{
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->WeaponComponent)
    {
        FPSCharacter->WeaponComponent->ReloadWeapon();
    }
}

void AFPSPlayerController::OnSwitchPrimaryRequested_Implementation()
{
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->WeaponComponent)
    {
        FPSCharacter->WeaponComponent->SwitchWeapon(0);
    }
}

void AFPSPlayerController::OnSwitchSecondaryRequested_Implementation()
{
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->WeaponComponent)
    {
        FPSCharacter->WeaponComponent->SwitchWeapon(1);
    }
}
