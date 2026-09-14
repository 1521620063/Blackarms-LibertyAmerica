#include "BLACharacterBase.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "BLAHealthComponent.h"
#include "BLAHitFeedbackComponent.h"
#include "BLAInteractionComponent.h"
#include "BLAWeaponComponent.h"
#include "GameFramework/CharacterMovementComponent.h"

ABLACharacterBase::ABLACharacterBase()
{
    PrimaryActorTick.bCanEverTick = false;
    bUseControllerRotationYaw = true;

    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
    FirstPersonCamera->SetRelativeLocation(FVector(-10.0f, 0.0f, 64.0f));
    FirstPersonCamera->bUsePawnControlRotation = true;

    HealthComponent = CreateDefaultSubobject<UBLAHealthComponent>(TEXT("HealthComponent"));
    InteractionComponent = CreateDefaultSubobject<UBLAInteractionComponent>(TEXT("InteractionComponent"));
    WeaponComponent = CreateDefaultSubobject<UBLAWeaponComponent>(TEXT("WeaponComponent"));
    HitFeedbackComponent = CreateDefaultSubobject<UBLAHitFeedbackComponent>(TEXT("HitFeedbackComponent"));

    GetCapsuleComponent()->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
    GetCharacterMovement()->bOrientRotationToMovement = false;
}

void ABLACharacterBase::BeginPlay()
{
    Super::BeginPlay();
    HealthComponent->OnDeath.AddUniqueDynamic(this, &ABLACharacterBase::HandleHealthDeath);
}

EBLA_Team ABLACharacterBase::GetTeam_Implementation() const
{
    return Team;
}

bool ABLACharacterBase::GetIsAlive_Implementation() const
{
    return HealthComponent && !HealthComponent->bIsDead;
}

bool ABLACharacterBase::ApplyCombatDamage_Implementation(float DamageAmount, FName DamageLocation, AActor* InstigatorActor)
{
    return HealthComponent && HealthComponent->ApplyDamage(DamageAmount, DamageLocation, InstigatorActor);
}

FVector ABLACharacterBase::GetCombatantWorldLocation_Implementation() const
{
    return GetActorLocation();
}

void ABLACharacterBase::ResetCombatant()
{
    HealthComponent->ResetHealth();
    WeaponComponent->ResetWeapons();
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
    GetCharacterMovement()->SetMovementMode(MOVE_Walking);
}

void ABLACharacterBase::HandleHealthDeath(AActor* InstigatorActor)
{
    GetCharacterMovement()->DisableMovement();
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}
