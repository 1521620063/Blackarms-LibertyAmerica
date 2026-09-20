#include "BLAPlayerController.h"

#include "Camera/CameraComponent.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "BLACharacterBase.h"
#include "BLAGameState.h"
#include "BLAGameInstance.h"
#include "BLAGameModeElimination.h"
#include "BLAHealthComponent.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "BLAWeaponComponent.h"
#include "Camera/CameraActor.h"
#include "EngineUtils.h"
#include "InputAction.h"
#include "InputMappingContext.h"

namespace
{
    const TCHAR* InputRoot = TEXT("/Game/BLA/Blueprints/Characters/Input/");

    template <typename T>
    T* LoadInputAsset(const TCHAR* Name)
    {
        const FString Path = FString::Printf(TEXT("%s%s.%s"), InputRoot, Name, Name);
        return LoadObject<T>(nullptr, *Path);
    }
}

ABLAPlayerController::ABLAPlayerController()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLAPlayerController::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bInTeamSpectatorMode && ControlledCombatant && ControlledCombatant->GetIsAlive())
    {
        const ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
        if (!State || State->RoundPhase == EBLA_RoundPhase::Preparation)
        {
            ExitTeamSpectatorMode();
        }
    }
}

void ABLAPlayerController::BeginPlay()
{
    Super::BeginPlay();

    if (ULocalPlayer* LocalPlayer = GetLocalPlayer())
    {
        if (UEnhancedInputLocalPlayerSubsystem* Subsystem = LocalPlayer->GetSubsystem<UEnhancedInputLocalPlayerSubsystem>())
        {
            if (UInputMappingContext* Context = LoadInputAsset<UInputMappingContext>(TEXT("IMC_BLAPlayer")))
            {
                Subsystem->AddMappingContext(Context, 0);
            }
        }
    }
}

void ABLAPlayerController::SetupInputComponent()
{
    Super::SetupInputComponent();
    BindInputActions();
}

void ABLAPlayerController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);
    BindControlledCombatant(Cast<ABLACharacterBase>(InPawn));
}

void ABLAPlayerController::BindInputActions()
{
    UEnhancedInputComponent* Enhanced = Cast<UEnhancedInputComponent>(InputComponent);
    if (!Enhanced)
    {
        return;
    }

    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Move")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Triggered, this, &ABLAPlayerController::HandleMove);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Look")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Triggered, this, &ABLAPlayerController::HandleLook);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Jump")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &ABLAPlayerController::HandleJumpStarted);
        Enhanced->BindAction(Action, ETriggerEvent::Completed, this, &ABLAPlayerController::HandleJumpCompleted);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Fire")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &ABLAPlayerController::OnFireRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Reload")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &ABLAPlayerController::OnReloadRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_SwitchPrimary")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &ABLAPlayerController::OnSwitchPrimaryRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_SwitchSecondary")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &ABLAPlayerController::OnSwitchSecondaryRequested);
    }
    if (UInputAction* Action = LoadInputAsset<UInputAction>(TEXT("IA_Command")))
    {
        Enhanced->BindAction(Action, ETriggerEvent::Started, this, &ABLAPlayerController::OnCommandRequested);
    }
}

void ABLAPlayerController::HandleMove(const FInputActionValue& Value)
{
    ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn());
    if (!BLACharacter || !BLACharacter->GetIsAlive())
    {
        return;
    }

    const FVector2D Movement = Value.Get<FVector2D>();
    const FRotator YawRotation(0.0f, GetControlRotation().Yaw, 0.0f);
    BLACharacter->AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Movement.Y);
    BLACharacter->AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Movement.X);
}

void ABLAPlayerController::HandleLook(const FInputActionValue& Value)
{
    const FVector2D Look = Value.Get<FVector2D>();
    AddYawInput(Look.X);
    AddPitchInput(Look.Y);
}

void ABLAPlayerController::HandleJumpStarted()
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->GetIsAlive())
    {
        BLACharacter->Jump();
    }
}

void ABLAPlayerController::HandleJumpCompleted()
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()))
    {
        BLACharacter->StopJumping();
    }
}

void ABLAPlayerController::OnFireRequested_Implementation()
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->FirstPersonCamera && BLACharacter->WeaponComponent)
    {
        const FVector TraceStart = BLACharacter->FirstPersonCamera->GetComponentLocation();
        const FVector AimDirection = BLACharacter->FirstPersonCamera->GetForwardVector();
        if (HasAuthority())
        {
            BLACharacter->WeaponComponent->FireWeapon(TraceStart, AimDirection);
        }
        else
        {
            ServerFireWeapon(TraceStart, AimDirection);
        }
    }
}

void ABLAPlayerController::OnReloadRequested_Implementation()
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->WeaponComponent)
    {
        if (HasAuthority())
        {
            BLACharacter->WeaponComponent->ReloadWeapon();
        }
        else
        {
            ServerReloadWeapon();
        }
    }
}

void ABLAPlayerController::OnSwitchPrimaryRequested_Implementation()
{
    if (bInTeamSpectatorMode)
    {
        CycleSpectatorTarget(-1);
        return;
    }
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->WeaponComponent)
    {
        BLACharacter->WeaponComponent->SwitchWeapon(0);
    }
}

void ABLAPlayerController::OnSwitchSecondaryRequested_Implementation()
{
    if (bInTeamSpectatorMode)
    {
        CycleSpectatorTarget(1);
        return;
    }
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->WeaponComponent)
    {
        BLACharacter->WeaponComponent->SwitchWeapon(1);
    }
}

void ABLAPlayerController::ConfigureTeamSystems(ABLATeamManager* InTeamManager, ABLATeamOrderManager* InOrderManager)
{
    TeamManager = InTeamManager;
    TeamOrderManager = InOrderManager;
    BindControlledCombatant(Cast<ABLACharacterBase>(GetPawn()));
}

bool ABLAPlayerController::IssueTeamOrder(EBLA_TeamOrder Order, FVector TargetLocation, EBLA_RoundPhase Phase, float DurationSeconds)
{
    return TeamOrderManager && ControlledCombatant && !bInTeamSpectatorMode
        && TeamOrderManager->SubmitOrder(Order, ControlledCombatant, TargetLocation, Phase, DurationSeconds);
}

TArray<ABLACharacterBase*> ABLAPlayerController::GetLivingFriendlySpectatorTargets() const
{
    TArray<ABLACharacterBase*> Result;
    if (!TeamManager || !ControlledCombatant)
    {
        return Result;
    }
    for (ABLACharacterBase* Friendly : TeamManager->GetTeamMembers(ControlledCombatant->Team))
    {
        if (Friendly && Friendly != ControlledCombatant && Friendly->GetIsAlive())
        {
            Result.Add(Friendly);
        }
    }
    return Result;
}

void ABLAPlayerController::CycleSpectatorTarget(int32 Direction)
{
    if (!bInTeamSpectatorMode)
    {
        return;
    }
    const TArray<ABLACharacterBase*> Targets = GetLivingFriendlySpectatorTargets();
    if (Targets.IsEmpty())
    {
        EnterTeamSpectatorMode();
        return;
    }
    int32 Index = Targets.IndexOfByKey(Cast<ABLACharacterBase>(SpectatorTarget));
    Index = Index == INDEX_NONE ? 0 : (Index + (Direction < 0 ? -1 : 1) + Targets.Num()) % Targets.Num();
    SelectSpectatorTarget(Targets[Index]);
}

void ABLAPlayerController::OnCommandRequested_Implementation()
{
    static constexpr EBLA_TeamOrder Orders[] = {
        EBLA_TeamOrder::FollowPlayer,
        EBLA_TeamOrder::HoldHere,
        EBLA_TeamOrder::AttackTarget,
        EBLA_TeamOrder::Retreat,
    };
    const ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
    const EBLA_RoundPhase Phase = State ? State->RoundPhase : EBLA_RoundPhase::Combat;
    FVector Target = ControlledCombatant ? ControlledCombatant->GetActorLocation() : FVector::ZeroVector;
    if (Orders[CommandIndex] == EBLA_TeamOrder::AttackTarget && PlayerCameraManager)
    {
        Target = PlayerCameraManager->GetCameraLocation() + PlayerCameraManager->GetCameraRotation().Vector() * 2500.0f;
    }
    IssueTeamOrder(Orders[CommandIndex], Target, Phase);
    CommandIndex = (CommandIndex + 1) % UE_ARRAY_COUNT(Orders);
}

void ABLAPlayerController::EnterTeamSpectatorMode()
{
    bInTeamSpectatorMode = true;
    const TArray<ABLACharacterBase*> Targets = GetLivingFriendlySpectatorTargets();
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

void ABLAPlayerController::ExitTeamSpectatorMode()
{
    bInTeamSpectatorMode = false;
    SelectSpectatorTarget(ControlledCombatant);
}

void ABLAPlayerController::BindControlledCombatant(ABLACharacterBase* Combatant)
{
    if (ControlledCombatant && ControlledCombatant->HealthComponent)
    {
        ControlledCombatant->HealthComponent->OnDeath.RemoveDynamic(this, &ABLAPlayerController::HandleControlledPawnDeath);
    }
    ControlledCombatant = Combatant;
    if (ControlledCombatant && ControlledCombatant->HealthComponent)
    {
        ControlledCombatant->HealthComponent->OnDeath.AddUniqueDynamic(this, &ABLAPlayerController::HandleControlledPawnDeath);
    }
}

void ABLAPlayerController::SelectSpectatorTarget(AActor* Target)
{
    SpectatorTarget = Target;
    if (Target)
    {
        SetViewTarget(Target);
    }
}

void ABLAPlayerController::HandleControlledPawnDeath(AActor* InstigatorActor)
{
    EnterTeamSpectatorMode();
}

void ABLAPlayerController::ServerSetTeam_Implementation(EBLA_Team Team)
{
    if (ABLAGameModeElimination* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr)
    {
        GameMode->SetLANTeam(this, Team);
    }
}

void ABLAPlayerController::ServerStartLANMatch_Implementation()
{
    if (ABLAGameModeElimination* GameMode = GetWorld() ? GetWorld()->GetAuthGameMode<ABLAGameModeElimination>() : nullptr)
    {
        GameMode->StartLANMatch(this);
    }
}

void ABLAPlayerController::ServerFireWeapon_Implementation(FVector TraceStart, FVector AimDirection)
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->WeaponComponent)
    {
        BLACharacter->WeaponComponent->FireWeapon(TraceStart, AimDirection);
    }
}

void ABLAPlayerController::ServerReloadWeapon_Implementation()
{
    if (ABLACharacterBase* BLACharacter = Cast<ABLACharacterBase>(GetPawn()); BLACharacter && BLACharacter->WeaponComponent)
    {
        BLACharacter->WeaponComponent->ReloadWeapon();
    }
}

void ABLAPlayerController::ClientNotifyFlowError_Implementation(const FString& Code)
{
    if (UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr)
    {
        GameInstance->ReportFlowFailure(Code);
        if (Code.Contains(TEXT("FLOW_LAN_HOST_LEFT"))
            || Code.Contains(TEXT("FLOW_LAN_JOIN_REJECTED_FULL"))
            || Code.Contains(TEXT("FLOW_LAN_JOIN_REJECTED_STARTED"))
            || Code.Contains(TEXT("FLOW_LAN_CONNECT_FAILED"))
            || Code.Contains(TEXT("FLOW_LAN_LISTEN_FAILED")))
        {
            GameInstance->RequestLeaveLAN();
        }
    }
}
