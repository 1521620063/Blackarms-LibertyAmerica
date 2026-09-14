#include "FPSGameModeElimination.h"
#include "FPSAIController.h"
#include "FPSCharacterBase.h"
#include "FPSGameState.h"
#include "FPSRoundManager.h"
#include "FPSSpawnPoint.h"
#include "FPSTeamManager.h"
#include "FPSWeaponBase.h"
#include "FPSWeaponComponent.h"
#include "FPSWeaponTypes.h"
#include "TimerManager.h"

AFPSGameModeElimination::AFPSGameModeElimination()
{
    GameStateClass = AFPSGameState::StaticClass();
}

void AFPSGameModeElimination::BeginPlay()
{
    Super::BeginPlay();
    TeamManager = GetWorld()->SpawnActor<AFPSTeamManager>();
    RoundManager = GetWorld()->SpawnActor<AFPSRoundManager>();
    GetWorldTimerManager().SetTimerForNextTick(this, &AFPSGameModeElimination::InitializeMatch);
}

void AFPSGameModeElimination::InitializeMatch()
{
    AFPSPlayerCharacter* Player = Cast<AFPSPlayerCharacter>(GetWorld()->GetFirstPlayerController() ? GetWorld()->GetFirstPlayerController()->GetPawn() : nullptr);
    if (!Player || !TeamManager || !RoundManager)
    {
        return;
    }
    Player->Team = EFPS_Team::Attackers;
    if (AFPSSpawnPoint* AttackerSpawn = TeamManager->SelectSpawnPoint(EFPS_Team::Attackers, TEXT("AttackSpawn")))
    {
        Player->SetActorTransform(AttackerSpawn->GetActorTransform());
    }

    AFPSSpawnPoint* DefenderSpawn = TeamManager->SelectSpawnPoint(EFPS_Team::Defenders, TEXT("DefenseSpawn"));
    const FTransform DefenderTransform = DefenderSpawn
        ? DefenderSpawn->GetActorTransform()
        : FTransform(FRotator(0.0f, 180.0f, 0.0f), FVector(900.0f, 0.0f, 120.0f));
    FActorSpawnParameters SpawnParameters;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    AFPSBotCharacter* Bot = GetWorld()->SpawnActor<AFPSBotCharacter>(AFPSBotCharacter::StaticClass(), DefenderTransform, SpawnParameters);
    AFPSAIController* AI = Bot ? GetWorld()->SpawnActor<AFPSAIController>() : nullptr;
    if (!Bot || !AI)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_ELIMINATION_MATCH_FAILED reason=defender_spawn"));
        return;
    }

    Bot->Team = EFPS_Team::Defenders;
    AI->Possess(Bot);
    const bool bPlayerRegistered = TeamManager->RegisterCombatant(Player);
    const bool bBotRegistered = TeamManager->RegisterCombatant(Bot);
    const bool bPlayerEquipped = EquipSoloLoadout(Player);
    const bool bBotEquipped = EquipSoloLoadout(Bot);
    if (!bPlayerRegistered || !bBotRegistered || !bPlayerEquipped || !bBotEquipped)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_ELIMINATION_MATCH_FAILED reason=registration_or_loadout player_registered=%d bot_registered=%d player_equipped=%d bot_equipped=%d"),
            bPlayerRegistered, bBotRegistered, bPlayerEquipped, bBotEquipped);
        return;
    }

    RoundManager->ConfigureManagers(GetGameState<AFPSGameState>(), TeamManager);
    FFPSMatchRules Rules;
    Rules.TeamSize = 1;
    Rules.RoundsToWin = 3;
    Rules.PreparationSeconds = 15.0f;
    Rules.CombatSeconds = 60.0f;
    RoundManager->StartMatch(Rules);
    UE_LOG(LogTemp, Display, TEXT("FPS_ELIMINATION_MATCH_READY mode=team_elimination scale=solo registration=2 loadouts=2 primary=pulse_rifle secondary=energy_pistol"));
}

bool AFPSGameModeElimination::EquipSoloLoadout(AFPSCharacterBase* Combatant) const
{
    if (!Combatant || !Combatant->WeaponComponent)
    {
        return false;
    }
    UFPSWeaponDataAsset* Rifle = LoadObject<UFPSWeaponDataAsset>(nullptr, TEXT("/Game/FPS/Data/Weapons/DA_FPSWeapon_PulseRifle.DA_FPSWeapon_PulseRifle"));
    UFPSWeaponDataAsset* Pistol = LoadObject<UFPSWeaponDataAsset>(nullptr, TEXT("/Game/FPS/Data/Weapons/DA_FPSWeapon_EnergyPistol.DA_FPSWeapon_EnergyPistol"));
    return Rifle && Pistol
        && Combatant->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), Rifle, 0)
        && Combatant->WeaponComponent->EquipWeapon(AFPSWeaponBase::StaticClass(), Pistol, 1);
}
