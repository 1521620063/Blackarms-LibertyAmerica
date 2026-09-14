#include "BLAAITestFixture.h"
#include "BLAAIController.h"
#include "BLABotPerception.h"
#include "BLACharacterBase.h"
#include "BLAHealthComponent.h"
#include "BLATacticalManager.h"
#include "BLATacticalPoint.h"
#include "BLAWeaponBase.h"
#include "BLAWeaponComponent.h"
#include "BLAWeaponTypes.h"

ABLAAITestFixture::ABLAAITestFixture()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ABLAAITestFixture::BeginPlay()
{
    Super::BeginPlay();
    const FVector Origin = FVector(GetActorLocation().X, GetActorLocation().Y - 1500.0f, 150.0f);
    ABLABotCharacter* Friendly = GetWorld()->SpawnActor<ABLABotCharacter>(Origin, FRotator::ZeroRotator);
    ABLABotCharacter* Enemy = GetWorld()->SpawnActor<ABLABotCharacter>(Origin + FVector(300.0f, 0.0f, 0.0f), FRotator::ZeroRotator);
    ABLAAIController* Controller = GetWorld()->SpawnActor<ABLAAIController>();
    ABLAAIController* EnemyController = GetWorld()->SpawnActor<ABLAAIController>();
    ABLATacticalManager* Manager = GetWorld()->SpawnActor<ABLATacticalManager>();
    ABLATacticalPoint* Cover = GetWorld()->SpawnActor<ABLATacticalPoint>(Origin + FVector(100.0f, 300.0f, 0.0f), FRotator::ZeroRotator);
    if (!Friendly || !Enemy || !Controller || !EnemyController || !Manager || !Cover)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_AI_SYSTEM_FAILED reason=spawn"));
        return;
    }
    Friendly->Team = EBLA_Team::Attackers;
    Enemy->Team = EBLA_Team::Defenders;
    Controller->Possess(Friendly);
    EnemyController->Possess(Enemy);
    Cover->PointType = EBLA_TacticalPointType::CoverPoint;
    Cover->PreferredRole = EBLA_BotRole::Assault;
    if (Controller->BotPerception->ReportStimulus(Friendly, Friendly, EBLA_StimulusType::Hearing, Friendly->GetActorLocation())
        || !Controller->BotPerception->ReportStimulus(Friendly, Enemy, EBLA_StimulusType::Sight, Enemy->GetActorLocation())
        || Controller->BotPerception->LastKnownTargetLocation != Enemy->GetActorLocation()
        || !Controller->BotPerception->ReportStimulus(Friendly, Enemy, EBLA_StimulusType::Hearing, Enemy->GetActorLocation())
        || !Controller->BotPerception->ReportStimulus(Friendly, Enemy, EBLA_StimulusType::Damage, Enemy->GetActorLocation())
        || Manager->FindBestPoint(Friendly, EBLA_TacticalPointType::CoverPoint, Friendly->Team, EBLA_BotRole::Assault) != Cover
        || !Manager->ReservePoint(Cover)
        || Manager->ReservePoint(Cover))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_AI_SYSTEM_FAILED reason=perception_or_tactics"));
        return;
    }
    Manager->ReleasePoint(Cover);
    Controller->bIsStuck = true;
    if (Controller->BotPerception->TargetActor != Enemy || Controller->BotPerception->LastStimulusType != EBLA_StimulusType::Damage)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_AI_SYSTEM_FAILED reason=target_memory"));
        return;
    }

    UBLAWeaponDataAsset* WeaponData = NewObject<UBLAWeaponDataAsset>(this);
    WeaponData->WeaponData.BaseDamage = 20.0f;
    WeaponData->WeaponData.MagazineCapacity = 3;
    WeaponData->WeaponData.ReserveAmmo = 0;
    WeaponData->WeaponData.RoundsPerMinute = 600.0f;
    WeaponData->WeaponData.MaxRange = 2000.0f;
    WeaponData->WeaponData.RangeFalloff = 1.0f;
    const bool bFriendlyEquipped = Friendly->WeaponComponent->EquipWeapon(ABLAWeaponBase::StaticClass(), WeaponData, 0);
    const bool bEnemyEquipped = Enemy->WeaponComponent->EquipWeapon(ABLAWeaponBase::StaticClass(), WeaponData, 0);
    const bool bFriendlyTargeted = Controller->UpdateTarget(Enemy, EBLA_StimulusType::Sight);
    const bool bEnemyTargeted = EnemyController->UpdateTarget(Friendly, EBLA_StimulusType::Sight);
    const bool bFriendlyFired = Controller->AimAndFireAtTarget();
    const bool bEnemyFired = EnemyController->AimAndFireAtTarget();
    if (!bFriendlyEquipped
        || !bEnemyEquipped
        || !bFriendlyTargeted
        || !bEnemyTargeted
        || !bFriendlyFired
        || !bEnemyFired
        || !FMath::IsNearlyEqual(Friendly->HealthComponent->CurrentHealth, 80.0f)
        || !FMath::IsNearlyEqual(Enemy->HealthComponent->CurrentHealth, 80.0f))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_AI_SYSTEM_FAILED reason=shared_weapon_combat"));
        return;
    }
    UE_LOG(LogTemp, Display, TEXT("BLA_AI_SYSTEM_OK perception=sight_hearing_damage teams=filtered tactics=cover_reserved stuck=detected recovery=request_guarded target=remembered combat=shared_weapon"));
}
