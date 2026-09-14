#include "BLAGameModeElimination.h"
#include "BLAAIController.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BLACharacterBase.h"
#include "BLAGameInstance.h"
#include "BLAGameState.h"
#include "BLAPlayerController.h"
#include "BLARoleAssignment.h"
#include "BLARoundManager.h"
#include "BLASpawnPoint.h"
#include "BLATacticalManager.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "BLAWeaponBase.h"
#include "BLAWeaponComponent.h"
#include "BLAWeaponTypes.h"
#include "TimerManager.h"

ABLAGameModeElimination::ABLAGameModeElimination()
{
    GameStateClass = ABLAGameState::StaticClass();
}

void ABLAGameModeElimination::BeginPlay()
{
    Super::BeginPlay();
    TeamManager = GetWorld()->SpawnActor<ABLATeamManager>();
    RoundManager = GetWorld()->SpawnActor<ABLARoundManager>();
    TeamOrderManager = GetWorld()->SpawnActor<ABLATeamOrderManager>();
    RoleAssignment = GetWorld()->SpawnActor<ABLARoleAssignment>();
    TacticalManager = GetWorld()->SpawnActor<ABLATacticalManager>();
    GetWorldTimerManager().SetTimer(InitializeMatchTimer, this, &ABLAGameModeElimination::InitializeMatch, 0.25f, false);
}

void ABLAGameModeElimination::InitializeMatch()
{
    ABLAPlayerCharacter* Player = Cast<ABLAPlayerCharacter>(GetWorld()->GetFirstPlayerController() ? GetWorld()->GetFirstPlayerController()->GetPawn() : nullptr);
    if (!Player || !TeamManager || !RoundManager || !TeamOrderManager || !RoleAssignment || !TacticalManager)
    {
        return;
    }
    const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
    const int32 TeamSize = FMath::Clamp(GameInstance ? GameInstance->SelectedTeamSize : 1, 1, 3);
    Player->Team = EBLA_Team::Attackers;
    if (ABLASpawnPoint* AttackerSpawn = TeamManager->SelectSpawnPoint(EBLA_Team::Attackers, TEXT("AttackSpawn")))
    {
        Player->SetActorTransform(AttackerSpawn->GetActorTransform());
    }

    const bool bPlayerRegistered = TeamManager->RegisterCombatant(Player);
    const bool bPlayerEquipped = EquipLoadout(Player);
    TArray<ABLAAIController*> AttackerBots;
    TArray<ABLAAIController*> DefenderBots;
    bool bBotsReady = true;
    for (int32 Index = 0; Index < TeamSize - 1; ++Index)
    {
        ABLAAIController* AI = SpawnBot(EBLA_Team::Attackers, Index + 1, TEXT("AttackSpawn"));
        bBotsReady &= AI != nullptr;
        if (AI)
        {
            AttackerBots.Add(AI);
        }
    }
    for (int32 Index = 0; Index < TeamSize; ++Index)
    {
        ABLAAIController* AI = SpawnBot(EBLA_Team::Defenders, Index, TEXT("DefenseSpawn"));
        bBotsReady &= AI != nullptr;
        if (AI)
        {
            DefenderBots.Add(AI);
        }
    }
    if (!bPlayerRegistered || !bPlayerEquipped || !bBotsReady)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_ELIMINATION_MATCH_FAILED reason=registration_or_loadout player_registered=%d player_equipped=%d bots_ready=%d"),
            bPlayerRegistered, bPlayerEquipped, bBotsReady);
        return;
    }

    RoleAssignment->AssignRoles(AttackerBots);
    RoleAssignment->AssignRoles(DefenderBots);
    for (ABLAAIController* AI : AttackerBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, Player);
    }
    for (ABLAAIController* AI : DefenderBots)
    {
        AI->ConfigureTeamOrders(TeamOrderManager);
        AI->ResolveRoleDirective(TacticalManager, TeamManager, nullptr);
    }
    if (ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(Player->GetController()))
    {
        PlayerController->ConfigureTeamSystems(TeamManager, TeamOrderManager);
    }
    RoundManager->ConfigureManagers(GetGameState<ABLAGameState>(), TeamManager, TeamOrderManager);
    RoundManager->StartMatch(ResolveRules(TeamSize));
    UE_LOG(LogTemp, Display, TEXT("BLA_ELIMINATION_MATCH_READY mode=team_elimination team_size=%d registration=%d attacker_bots=%d defender_bots=%d roles=deterministic loadouts=%d primary=pulse_rifle secondary=energy_pistol"),
        TeamSize, TeamSize * 2, AttackerBots.Num(), DefenderBots.Num(), TeamSize * 2);
}

ABLAAIController* ABLAGameModeElimination::SpawnBot(EBLA_Team Team, int32 TeamIndex, FName PreferredZone)
{
    ABLASpawnPoint* Spawn = TeamManager->SelectSpawnPoint(Team, PreferredZone);
    const float Side = Team == EBLA_Team::Attackers ? -1.0f : 1.0f;
    const FTransform Transform = Spawn ? Spawn->GetActorTransform()
        : FTransform(FRotator(0.0f, Team == EBLA_Team::Attackers ? 0.0f : 180.0f, 0.0f),
            FVector(Side * 900.0f, (TeamIndex - 1) * 250.0f, 120.0f));
    FActorSpawnParameters SpawnParameters;
    SpawnParameters.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;
    ABLABotCharacter* Bot = GetWorld()->SpawnActor<ABLABotCharacter>(ABLABotCharacter::StaticClass(), Transform, SpawnParameters);
    ABLAAIController* AI = Bot ? GetWorld()->SpawnActor<ABLAAIController>() : nullptr;
    if (!Bot || !AI)
    {
        if (Bot)
        {
            Bot->Destroy();
        }
        return nullptr;
    }
    Bot->Team = Team;
    AI->EliminationTree = LoadObject<UBehaviorTree>(nullptr, TEXT("/Game/BLA/AI/BehaviorTrees/BT_BLABotElimination.BT_BLABotElimination"));
    if (const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>())
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

bool ABLAGameModeElimination::EquipLoadout(ABLACharacterBase* Combatant) const
{
    if (!Combatant || !Combatant->WeaponComponent)
    {
        return false;
    }
    UBLAWeaponDataAsset* Rifle = LoadObject<UBLAWeaponDataAsset>(nullptr, TEXT("/Game/BLA/Data/Weapons/DA_BLAWeapon_PulseRifle.DA_BLAWeapon_PulseRifle"));
    UBLAWeaponDataAsset* Pistol = LoadObject<UBLAWeaponDataAsset>(nullptr, TEXT("/Game/BLA/Data/Weapons/DA_BLAWeapon_EnergyPistol.DA_BLAWeapon_EnergyPistol"));
    return Rifle && Pistol
        && Combatant->WeaponComponent->EquipWeapon(ABLAWeaponBase::StaticClass(), Rifle, 0)
        && Combatant->WeaponComponent->EquipWeapon(ABLAWeaponBase::StaticClass(), Pistol, 1);
}

FBLAMatchRules ABLAGameModeElimination::ResolveRules(int32 TeamSize) const
{
    FBLAMatchRules Rules;
    const UBLAGameInstance* GameInstance = GetGameInstance<UBLAGameInstance>();
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
