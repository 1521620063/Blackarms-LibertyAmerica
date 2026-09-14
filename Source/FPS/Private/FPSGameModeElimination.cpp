#include "FPSGameModeElimination.h"
#include "FPSAIController.h"
#include "BehaviorTree/BehaviorTree.h"
#include "FPSCharacterBase.h"
#include "FPSGameInstance.h"
#include "FPSGameState.h"
#include "FPSPlayerController.h"
#include "FPSRoleAssignment.h"
#include "FPSRoundManager.h"
#include "FPSSpawnPoint.h"
#include "FPSTacticalManager.h"
#include "FPSTeamManager.h"
#include "FPSTeamOrderManager.h"
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
    TeamOrderManager = GetWorld()->SpawnActor<AFPSTeamOrderManager>();
    RoleAssignment = GetWorld()->SpawnActor<AFPSRoleAssignment>();
    TacticalManager = GetWorld()->SpawnActor<AFPSTacticalManager>();
    GetWorldTimerManager().SetTimer(InitializeMatchTimer, this, &AFPSGameModeElimination::InitializeMatch, 0.25f, false);
}

void AFPSGameModeElimination::InitializeMatch()
{
    AFPSPlayerCharacter* Player = Cast<AFPSPlayerCharacter>(GetWorld()->GetFirstPlayerController() ? GetWorld()->GetFirstPlayerController()->GetPawn() : nullptr);
    if (!Player || !TeamManager || !RoundManager || !TeamOrderManager || !RoleAssignment || !TacticalManager)
    {
        return;
    }
    const UFPSGameInstance* GameInstance = GetGameInstance<UFPSGameInstance>();
    const int32 TeamSize = FMath::Clamp(GameInstance ? GameInstance->SelectedTeamSize : 1, 1, 3);
    Player->Team = EFPS_Team::Attackers;
    if (AFPSSpawnPoint* AttackerSpawn = TeamManager->SelectSpawnPoint(EFPS_Team::Attackers, TEXT("AttackSpawn")))
    {
        Player->SetActorTransform(AttackerSpawn->GetActorTransform());
    }

    const bool bPlayerRegistered = TeamManager->RegisterCombatant(Player);
    const bool bPlayerEquipped = EquipLoadout(Player);
    TArray<AFPSAIController*> AttackerBots;
    TArray<AFPSAIController*> DefenderBots;
    bool bBotsReady = true;
    for (int32 Index = 0; Index < TeamSize - 1; ++Index)
    {
        AFPSAIController* AI = SpawnBot(EFPS_Team::Attackers, Index + 1, TEXT("AttackSpawn"));
        bBotsReady &= AI != nullptr;
        if (AI)
        {
            AttackerBots.Add(AI);
        }
    }
    for (int32 Index = 0; Index < TeamSize; ++Index)
    {
        AFPSAIController* AI = SpawnBot(EFPS_Team::Defenders, Index, TEXT("DefenseSpawn"));
        bBotsReady &= AI != nullptr;
        if (AI)
        {
            DefenderBots.Add(AI);
        }
    }
    if (!bPlayerRegistered || !bPlayerEquipped || !bBotsReady)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_ELIMINATION_MATCH_FAILED reason=registration_or_loadout player_registered=%d player_equipped=%d bots_ready=%d"),
            bPlayerRegistered, bPlayerEquipped, bBotsReady);
        return;
    }

    RoleAssignment->AssignRoles(AttackerBots);
    RoleAssignment->AssignRoles(DefenderBots);
    for (AFPSAIController* AI : AttackerBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, Player);
    }
    for (AFPSAIController* AI : DefenderBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, nullptr);
    }
    if (AFPSPlayerController* PlayerController = Cast<AFPSPlayerController>(Player->GetController()))
    {
        PlayerController->ConfigureTeamSystems(TeamManager, TeamOrderManager);
    }
    RoundManager->ConfigureManagers(GetGameState<AFPSGameState>(), TeamManager, TeamOrderManager);
    RoundManager->StartMatch(ResolveRules(TeamSize));
    UE_LOG(LogTemp, Display, TEXT("FPS_ELIMINATION_MATCH_READY mode=team_elimination team_size=%d registration=%d attacker_bots=%d defender_bots=%d roles=deterministic loadouts=%d primary=pulse_rifle secondary=energy_pistol"),
        TeamSize, TeamSize * 2, AttackerBots.Num(), DefenderBots.Num(), TeamSize * 2);
}

AFPSAIController* AFPSGameModeElimination::SpawnBot(EFPS_Team Team, int32 TeamIndex, FName PreferredZone)
{
    AFPSSpawnPoint* Spawn = TeamManager->SelectSpawnPoint(Team, PreferredZone);
    const float Side = Team == EFPS_Team::Attackers ? -1.0f : 1.0f;
    const FTransform Transform = Spawn ? Spawn->GetActorTransform()
        : FTransform(FRotator(0.0f, Team == EFPS_Team::Attackers ? 0.0f : 180.0f, 0.0f),
            FVector(Side * 900.0f, (TeamIndex - 1) * 250.0f, 120.0f));
    FActorSpawnParameters SpawnParameters;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    AFPSBotCharacter* Bot = GetWorld()->SpawnActor<AFPSBotCharacter>(AFPSBotCharacter::StaticClass(), Transform, SpawnParameters);
    AFPSAIController* AI = Bot ? GetWorld()->SpawnActor<AFPSAIController>() : nullptr;
    if (!Bot || !AI)
    {
        if (Bot)
        {
            Bot->Destroy();
        }
        return nullptr;
    }
    Bot->Team = Team;
    AI->EliminationTree = LoadObject<UBehaviorTree>(nullptr, TEXT("/Game/FPS/AI/BehaviorTrees/BT_FPSBotElimination.BT_FPSBotElimination"));
    if (const UFPSGameInstance* GameInstance = GetGameInstance<UFPSGameInstance>())
    {
        AI->ApplyDifficulty(GameInstance->SelectedDifficulty);
    }
    AI->Possess(Bot);
    if (!TeamManager->RegisterCombatant(Bot) || !EquipLoadout(Bot))
    {
        AI->Destroy();
        Bot->Destroy();
        return nullptr;
    }
    return AI;
}

bool AFPSGameModeElimination::EquipLoadout(AFPSCharacterBase* Combatant) const
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

FFPSMatchRules AFPSGameModeElimination::ResolveRules(int32 TeamSize) const
{
    FFPSMatchRules Rules;
    const UFPSGameInstance* GameInstance = GetGameInstance<UFPSGameInstance>();
    const bool bHasMatchingRules = GameInstance && GameInstance->SelectedRules
        && GameInstance->SelectedRules->Rules.TeamSize == TeamSize;
    if (bHasMatchingRules)
    {
        Rules = GameInstance->SelectedRules->Rules;
    }
    Rules.TeamSize = TeamSize;
    if (!bHasMatchingRules)
    {
        Rules.CombatSeconds = TeamSize == 1 ? 60.0f : TeamSize == 2 ? 75.0f : 90.0f;
        Rules.RoundsToWin = TeamSize == 1 ? 3 : TeamSize == 2 ? 4 : 5;
        Rules.SwitchSidesAfterRound = TeamSize == 3 ? 4 : 2;
    }
    return Rules;
}
