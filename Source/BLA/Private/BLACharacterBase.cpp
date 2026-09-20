#include "BLACharacterBase.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "BLAHealthComponent.h"
#include "BLAHitFeedbackComponent.h"
#include "BLAInteractionComponent.h"
#include "BLAWeaponComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Perception/AIPerceptionStimuliSourceComponent.h"
#include "Perception/AISense_Damage.h"
#include "Perception/AISense_Hearing.h"
#include "Perception/AISense_Sight.h"
#include "Net/UnrealNetwork.h"

ABLACharacterBase::ABLACharacterBase()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = true;
    SetReplicateMovement(true);
    bUseControllerRotationYaw = true;

    FirstPersonCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FirstPersonCamera"));
    FirstPersonCamera->SetupAttachment(GetCapsuleComponent());
    FirstPersonCamera->SetRelativeLocation(FVector(-10.0f, 0.0f, 64.0f));
    FirstPersonCamera->bUsePawnControlRotation = true;

    HealthComponent = CreateDefaultSubobject<UBLAHealthComponent>(TEXT("HealthComponent"));
    InteractionComponent = CreateDefaultSubobject<UBLAInteractionComponent>(TEXT("InteractionComponent"));
    WeaponComponent = CreateDefaultSubobject<UBLAWeaponComponent>(TEXT("WeaponComponent"));
    HitFeedbackComponent = CreateDefaultSubobject<UBLAHitFeedbackComponent>(TEXT("HitFeedbackComponent"));

    // Register combatants as perception sources so AI senses can actually detect them.
    PerceptionSource = CreateDefaultSubobject<UAIPerceptionStimuliSourceComponent>(TEXT("PerceptionSource"));
    PerceptionSource->RegisterForSense(UAISense_Sight::StaticClass());
    PerceptionSource->RegisterForSense(UAISense_Hearing::StaticClass());
    PerceptionSource->RegisterForSense(UAISense_Damage::StaticClass());

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

FGenericTeamId ABLACharacterBase::GetGenericTeamId() const
{
    // AI perception filters by affiliation; without this every combatant looks neutral and
    // sight detection ignores it.
    return FGenericTeamId(static_cast<uint8>(Team));
}

ETeamAttitude::Type ABLACharacterBase::GetTeamAttitudeTowards(const AActor& Other) const
{
    const ABLACharacterBase* OtherCombatant = Cast<ABLACharacterBase>(&Other);
    if (!OtherCombatant)
    {
        return ETeamAttitude::Neutral;
    }
    if (OtherCombatant->Team == Team)
    {
        return ETeamAttitude::Friendly;
    }
    if (Team == EBLA_Team::Neutral || OtherCombatant->Team == EBLA_Team::Neutral)
    {
        return ETeamAttitude::Neutral;
    }
    return ETeamAttitude::Hostile;
}

void ABLACharacterBase::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ABLACharacterBase, Team);
}

void ABLACharacterBase::HandleHealthDeath(AActor* InstigatorActor)
{
    GetCharacterMovement()->DisableMovement();
    GetCapsuleComponent()->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}
