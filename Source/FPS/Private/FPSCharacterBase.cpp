#include "FPSCharacterBase.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "FPSHealthComponent.h"
#include "FPSHitFeedbackComponent.h"
#include "FPSInteractionComponent.h"
#include "FPSWeaponComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

AFPSCharacterBase::AFPSCharacterBase()
{
    PrimaryActorTick.bCanEverTick = false;
    bUseControllerRotationYaw = true;

    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
    FirstPersonCamera->SetRelativeLocation(FVector(-10.0f, 0.0f, 64.0f));
    FirstPersonCamera->bUsePawnControlRotation = true;

    HealthComponent = CreateDefaultSubobject<UFPSHealthComponent>(TEXT("HealthComponent"));
    InteractionComponent = CreateDefaultSubobject<UFPSInteractionComponent>(TEXT("InteractionComponent"));
    WeaponComponent = CreateDefaultSubobject<UFPSWeaponComponent>(TEXT("WeaponComponent"));
    HitFeedbackComponent = CreateDefaultSubobject<UFPSHitFeedbackComponent>(TEXT("HitFeedbackComponent"));

    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
    GetCharacterMovement()->bOrientRotationToMovement = false;
}

void AFPSCharacterBase::BeginPlay()
{
    Super::BeginPlay();
    HealthComponent->OnDeath.AddUniqueDynamic(this, &AFPSCharacterBase::HandleHealthDeath);
}

EFPS_Team AFPSCharacterBase::GetTeam_Implementation() const
{
    return Team;
}

bool AFPSCharacterBase::GetIsAlive_Implementation() const
{
    return HealthComponent && !HealthComponent->bIsDead;
}

bool AFPSCharacterBase::ApplyCombatDamage_Implementation(float DamageAmount, FName DamageLocation, AActor* InstigatorActor)
{
    return HealthComponent && HealthComponent->ApplyDamage(DamageAmount, DamageLocation, InstigatorActor);
}

FVector AFPSCharacterBase::GetCombatantWorldLocation_Implementation() const
{
    return GetActorLocation();
}

void AFPSCharacterBase::ResetCombatant()
{
    HealthComponent->ResetHealth();
    WeaponComponent->ResetWeapons();
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    GetCharacterMovement()->SetMovementMode(MOVE_Walking);
}

void AFPSCharacterBase::HandleHealthDeath(AActor* InstigatorActor)
{
    GetCharacterMovement()->DisableMovement();
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}
