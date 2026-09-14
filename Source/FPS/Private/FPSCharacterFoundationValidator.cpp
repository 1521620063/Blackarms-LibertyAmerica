#include "FPSCharacterFoundationValidator.h"

#include "Components/CapsuleComponent.h"
#include "FPSCharacterBase.h"
#include "FPSHealthComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerStart.h"
#include "Kismet/GameplayStatics.h"

AFPSCharacterFoundationValidator::AFPSCharacterFoundationValidator()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AFPSCharacterFoundationValidator::BeginPlay()
{
    Super::BeginPlay();

    const AActor* PlayerStart = UGameplayStatics::GetActorOfClass(this, APlayerStart::StaticClass());
    const FVector SpawnLocation = PlayerStart ? PlayerStart->GetActorLocation() : FVector(0.0f, 0.0f, 150.0f);
    const FRotator SpawnRotation = PlayerStart ? PlayerStart->GetActorRotation() : FRotator::ZeroRotator;
    TestCharacter = GetWorld()->SpawnActor<AFPSPlayerCharacter>(SpawnLocation, SpawnRotation);
    APlayerController* PlayerController = UGameplayStatics::GetPlayerController(this, 0);
    if (!TestCharacter || !PlayerController)
    {
        Fail(TEXT("spawn_or_controller"));
        return;
    }

    PlayerController->Possess(TestCharacter);
    TestCharacter->HealthComponent->OnDeathNative.AddUObject(this, &AFPSCharacterFoundationValidator::HandleDeath);
    if (!FMath::IsNearlyEqual(TestCharacter->HealthComponent->CurrentHealth, 100.0f)
        || TestCharacter->HealthComponent->bIsDead)
    {
        Fail(TEXT("initial_health"));
    }
}

void AFPSCharacterFoundationValidator::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bFinished || !TestCharacter)
    {
        return;
    }

    ++TickCount;
    if (TickCount == 10)
    {
        MovementStart = TestCharacter->GetActorLocation();
        MaximumJumpZ = MovementStart.Z;
        InitialYaw = TestCharacter->GetControlRotation().Yaw;
        TestCharacter->AddControllerYawInput(10.0f);
        TestCharacter->Jump();
    }

    if (TickCount >= 10 && TickCount < 40)
    {
        TestCharacter->AddMovementInput(TestCharacter->GetActorForwardVector(), 1.0f);
        MaximumJumpZ = FMath::Max(MaximumJumpZ, TestCharacter->GetActorLocation().Z);
        return;
    }

    if (TickCount != 40)
    {
        return;
    }

    const float TravelDistance = FVector::Dist2D(MovementStart, TestCharacter->GetActorLocation());
    const float YawDelta = FMath::Abs(FMath::FindDeltaAngleDegrees(InitialYaw, TestCharacter->GetControlRotation().Yaw));
    if (TravelDistance <= 5.0f || YawDelta <= 0.1f || MaximumJumpZ <= MovementStart.Z + 5.0f)
    {
        Fail(TEXT("move_look_jump"));
        return;
    }

    UFPSHealthComponent* Health = TestCharacter->HealthComponent;
    if (!Health->ApplyDamage(25.0f, TEXT("Body"), nullptr)
        || !FMath::IsNearlyEqual(Health->CurrentHealth, 75.0f))
    {
        Fail(TEXT("clamped_damage"));
        return;
    }
    if (!Health->ApplyDamage(1000.0f, TEXT("Body"), nullptr)
        || !Health->bIsDead
        || !FMath::IsNearlyZero(Health->CurrentHealth)
        || DeathEventCount != 1)
    {
        Fail(TEXT("death_once"));
        return;
    }
    if (Health->ApplyDamage(10.0f, TEXT("Body"), nullptr) || DeathEventCount != 1)
    {
        Fail(TEXT("reject_after_death"));
        return;
    }
    if (TestCharacter->GetCharacterMovement()->MovementMode != MOVE_None
        || TestCharacter->GetCapsuleComponent()->GetCollisionEnabled() != ECollisionEnabled::NoCollision)
    {
        Fail(TEXT("disable_after_death"));
        return;
    }

    TestCharacter->ResetCombatant();
    if (Health->bIsDead
        || !FMath::IsNearlyEqual(Health->CurrentHealth, 100.0f)
        || TestCharacter->GetCharacterMovement()->MovementMode != MOVE_Walking
        || TestCharacter->GetCapsuleComponent()->GetCollisionEnabled() != ECollisionEnabled::QueryAndPhysics)
    {
        Fail(TEXT("reset_full_health"));
        return;
    }

    UE_LOG(
        LogTemp,
        Display,
        TEXT("FPS_CHARACTER_FOUNDATION_OK health=100 death_events=1 movement=disabled reset=full input=move_look_jump")
    );
    bFinished = true;
    SetActorTickEnabled(false);
}

void AFPSCharacterFoundationValidator::Fail(const TCHAR* Reason)
{
    UE_LOG(LogTemp, Error, TEXT("FPS_CHARACTER_FOUNDATION_FAILED reason=%s"), Reason);
    bFinished = true;
    SetActorTickEnabled(false);
}

void AFPSCharacterFoundationValidator::HandleDeath(AActor* InstigatorActor)
{
    ++DeathEventCount;
}
