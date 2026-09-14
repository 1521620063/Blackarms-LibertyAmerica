#include "FPSPlayerController.h"

#include "Camera/CameraComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "FPSCharacterBase.h"
#include "FPSGameState.h"
#include "FPSHealthComponent.h"
#include "FPSTeamManager.h"
#include "FPSTeamOrderManager.h"
#include "FPSWeaponComponent.h"
#include "Camera/CameraActor.h"
#include "EngineUtils.h"
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

AFPSPlayerController::AFPSPlayerController()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AFPSPlayerController::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bInTeamSpectatorMode && ControlledCombatant && ControlledCombatant->GetIsAlive())
    {
        const AFPSGameState* State = GetWorld() ? GetWorld()->GetGameState<AFPSGameState>() : nullptr;
        if (!State || State->RoundPhase == EFPS_RoundPhase::Preparation)
        {
            ExitTeamSpectatorMode();
        }
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

void AFPSPlayerController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);
    BindControlledCombatant(Cast<AFPSCharacterBase>(InPawn));
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
    if (bInTeamSpectatorMode)
    {
        CycleSpectatorTarget(-1);
        return;
    }
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->WeaponComponent)
    {
        FPSCharacter->WeaponComponent->SwitchWeapon(0);
    }
}

void AFPSPlayerController::OnSwitchSecondaryRequested_Implementation()
{
    if (bInTeamSpectatorMode)
    {
        CycleSpectatorTarget(1);
        return;
    }
    if (AFPSCharacterBase* FPSCharacter = Cast<AFPSCharacterBase>(GetPawn()); FPSCharacter && FPSCharacter->WeaponComponent)
    {
        FPSCharacter->WeaponComponent->SwitchWeapon(1);
    }
}

void AFPSPlayerController::ConfigureTeamSystems(AFPSTeamManager* InTeamManager, AFPSTeamOrderManager* InOrderManager)
{
    TeamManager = InTeamManager;
    TeamOrderManager = InOrderManager;
    BindControlledCombatant(Cast<AFPSCharacterBase>(GetPawn()));
}

bool AFPSPlayerController::IssueTeamOrder(EFPS_TeamOrder Order, FVector TargetLocation, EFPS_RoundPhase Phase, float DurationSeconds)
{
    return TeamOrderManager && ControlledCombatant && !bInTeamSpectatorMode
        && TeamOrderManager->SubmitOrder(Order, ControlledCombatant, TargetLocation, Phase, DurationSeconds);
}

TArray<AFPSCharacterBase*> AFPSPlayerController::GetLivingFriendlySpectatorTargets() const
{
    TArray<AFPSCharacterBase*> Result;
    if (!TeamManager || !ControlledCombatant)
    {
        return Result;
    }
    for (AFPSCharacterBase* Friendly : TeamManager->GetTeamMembers(ControlledCombatant->Team))
    {
        if (Friendly && Friendly != ControlledCombatant && Friendly->GetIsAlive())
        {
            Result.Add(Friendly);
        }
    }
    return Result;
}

void AFPSPlayerController::CycleSpectatorTarget(int32 Direction)
{
    if (!bInTeamSpectatorMode)
    {
        return;
    }
    const TArray<AFPSCharacterBase*> Targets = GetLivingFriendlySpectatorTargets();
    if (Targets.IsEmpty())
    {
        EnterTeamSpectatorMode();
        return;
    }
    int32 Index = Targets.IndexOfByKey(Cast<AFPSCharacterBase>(SpectatorTarget));
    Index = Index == INDEX_NONE ? 0 : (Index + (Direction < 0 ? -1 : 1) + Targets.Num()) % Targets.Num();
    SelectSpectatorTarget(Targets[Index]);
}

void AFPSPlayerController::OnCommandRequested_Implementation()
{
    static constexpr EFPS_TeamOrder Orders[] = {
        EFPS_TeamOrder::FollowPlayer,
        EFPS_TeamOrder::HoldHere,
        EFPS_TeamOrder::AttackTarget,
        EFPS_TeamOrder::Retreat,
    };
    const AFPSGameState* State = GetWorld() ? GetWorld()->GetGameState<AFPSGameState>() : nullptr;
    const EFPS_RoundPhase Phase = State ? State->RoundPhase : EFPS_RoundPhase::Combat;
    FVector Target = ControlledCombatant ? ControlledCombatant->GetActorLocation() : FVector::ZeroVector;
    if (Orders[CommandIndex] == EFPS_TeamOrder::AttackTarget && PlayerCameraManager)
    {
        Target = PlayerCameraManager->GetCameraLocation() + PlayerCameraManager->GetCameraRotation().Vector() * 2500.0f;
    }
    IssueTeamOrder(Orders[CommandIndex], Target, Phase);
    CommandIndex = (CommandIndex + 1) % UE_ARRAY_COUNT(Orders);
}

void AFPSPlayerController::EnterTeamSpectatorMode()
{
    bInTeamSpectatorMode = true;
    const TArray<AFPSCharacterBase*> Targets = GetLivingFriendlySpectatorTargets();
    if (!Targets.IsEmpty())
    {
        SelectSpectatorTarget(Targets[0]);
        return;
    }
    for (TActorIterator<ACameraActor> It(GetWorld()); It; ++It)
    {
        if (It->ActorHasTag(TEXT("FixedSpectatorCamera")))
        {
            SelectSpectatorTarget(*It);
            return;
        }
    }
    SelectSpectatorTarget(nullptr);
}

void AFPSPlayerController::ExitTeamSpectatorMode()
{
    bInTeamSpectatorMode = false;
    SelectSpectatorTarget(ControlledCombatant);
}

void AFPSPlayerController::BindControlledCombatant(AFPSCharacterBase* Combatant)
{
    if (ControlledCombatant && ControlledCombatant->HealthComponent)
    {
        ControlledCombatant->HealthComponent->OnDeath.RemoveDynamic(this, &AFPSPlayerController::HandleControlledPawnDeath);
    }
    ControlledCombatant = Combatant;
    if (ControlledCombatant && ControlledCombatant->HealthComponent)
    {
        ControlledCombatant->HealthComponent->OnDeath.AddUniqueDynamic(this, &AFPSPlayerController::HandleControlledPawnDeath);
    }
}

void AFPSPlayerController::SelectSpectatorTarget(AActor* Target)
{
    SpectatorTarget = Target;
    if (Target)
    {
        SetViewTarget(Target);
    }
}

void AFPSPlayerController::HandleControlledPawnDeath(AActor* InstigatorActor)
{
    EnterTeamSpectatorMode();
}
