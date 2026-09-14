#include "FPSAITestFixture.h"
#include "FPSAIController.h"
#include "FPSBotPerception.h"
#include "FPSCharacterBase.h"
#include "FPSHealthComponent.h"
#include "FPSTacticalManager.h"
#include "FPSTacticalPoint.h"
#include "FPSWeaponBase.h"
#include "FPSWeaponComponent.h"
#include "FPSWeaponTypes.h"

AFPSAITestFixture::AFPSAITestFixture()
{
    PrimaryActorTick.bCanEverTick = false;
}

void AFPSAITestFixture::BeginPlay()
{
    Super::BeginPlay();
    const FVector Origin = FVector(GetActorLocation().X, GetActorLocation().Y - 1500.0f, 150.0f);
    AFPSBotCharacter* Friendly = GetWorld()->SpawnActor<AFPSBotCharacter>(Origin, FRotator::ZeroRotator);
    AFPSBotCharacter* Enemy = GetWorld()->SpawnActor<AFPSBotCharacter>(Origin + FVector(300.0f, 0.0f, 0.0f), FRotator::ZeroRotator);
    AFPSAIController* Controller = GetWorld()->SpawnActor<AFPSAIController>();
    AFPSAIController* EnemyController = GetWorld()->SpawnActor<AFPSAIController>();
    AFPSTacticalManager* Manager = GetWorld()->SpawnActor<AFPSTacticalManager>();
    AFPSTacticalPoint* Cover = GetWorld()->SpawnActor<AFPSTacticalPoint>(Origin + FVector(100.0f, 300.0f, 0.0f), FRotator::ZeroRotator);
    if (!Friendly || !Enemy || !Controller || !EnemyController || !Manager || !Cover)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_AI_SYSTEM_FAILED reason=spawn"));
        return;
    }
    Friendly->Team = EFPS_Team::Attackers;
    Enemy->Team = EFPS_Team::Defenders;
    Controller->Possess(Friendly);
    EnemyController->Possess(Enemy);
    Cover->PointType = EFPS_TacticalPointType::CoverPoint;
    Cover->PreferredRole = EFPS_BotRole::Assault;
    if (Controller->BotPerception->ReportStimulus(Friendly, Friendly, EFPS_StimulusType::Hearing, Friendly->GetActorLocation())
        || !Controller->BotPerception->ReportStimulus(Friendly, Enemy, EFPS_StimulusType::Sight, Enemy->GetActorLocation())
        || Controller->BotPerception->LastKnownTargetLocation != Enemy->GetActorLocation()
        || !Controller->BotPerception->ReportStimulus(Friendly, Enemy, EFPS_StimulusType::Hearing, Enemy->GetActorLocation())
        || !Controller->BotPerception->ReportStimulus(Friendly, Enemy, EFPS_StimulusType::Damage, Enemy->GetActorLocation())
        || Manager->FindBestPoint(Friendly, EFPS_TacticalPointType::CoverPoint, Friendly->Team, EFPS_BotRole::Assault) != Cover
        || !Manager->ReservePoint(Cover)
        || Manager->ReservePoint(Cover))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_AI_SYSTEM_FAILED reason=perception_or_tactics"));
        return;
    }
    Manager->ReleasePoint(Cover);
    Controller->bIsStuck = true;
    if (Controller->BotPerception->TargetActor != Enemy || Controller->BotPerception->LastStimulusType != EFPS_StimulusType::Damage)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_AI_SYSTEM_FAILED reason=target_memory"));
        return;
    }

    UFPSWeaponDataAsset* WeaponData = NewObject<UFPSWeaponDataAsset>(this);
    WeaponData->WeaponData.BaseDamage = 20.0f;
    WeaponData->WeaponData.MagazineCapacity = 3;
    WeaponData->WeaponData.ReserveAmmo = 0;
    WeaponData->WeaponData.RoundsPerMinute = 600.0f;
    WeaponData->WeaponData.MaxRange = 2000.0f;
    WeaponData->WeaponData.RangeFalloff = 1.0f;
    const bool bFriendlyEquipped = Friendly->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), WeaponData, 0);
    const bool bEnemyEquipped = Enemy->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), WeaponData, 0);
    const bool bFriendlyTargeted = Controller->UpdateTarget(Enemy, EFPS_StimulusType::Sight);
    const bool bEnemyTargeted = EnemyController->UpdateTarget(Friendly, EFPS_StimulusType::Sight);
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
        UE_LOG(LogTemp, Error, TEXT("FPS_AI_SYSTEM_FAILED reason=shared_weapon_combat"));
        return;
    }
    UE_LOG(LogTemp, Display, TEXT("FPS_AI_SYSTEM_OK perception=sight_hearing_damage teams=filtered tactics=cover_reserved stuck=detected recovery=request_guarded target=remembered combat=shared_weapon"));
}
