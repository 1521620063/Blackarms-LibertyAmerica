#include "FPS3v3EliminationTest.h"

#include "FPSAIController.h"
#include "Camera/CameraActor.h"
#include "FPSCharacterBase.h"
#include "FPSGameState.h"
#include "FPSHealthComponent.h"
#include "FPSPlayerController.h"
#include "FPSRoleAssignment.h"
#include "FPSRoundManager.h"
#include "FPSTacticalManager.h"
#include "FPSTacticalPoint.h"
#include "FPSTeamManager.h"
#include "FPSTeamOrderManager.h"

AFPS3v3EliminationTest::AFPS3v3EliminationTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

void AFPS3v3EliminationTest::BeginPlay()
{
    Super::BeginPlay();

    AFPSTeamOrderManager* Orders = GetWorld()->SpawnActor<AFPSTeamOrderManager>();
    AFPSRoleAssignment* Roles = GetWorld()->SpawnActor<AFPSRoleAssignment>();
    AFPSTeamManager* Teams = GetWorld()->SpawnActor<AFPSTeamManager>();
    AFPSTacticalManager* Tactics = GetWorld()->SpawnActor<AFPSTacticalManager>();
    AFPSGameState* State = GetWorld()->SpawnActor<AFPSGameState>();
    AFPSRoundManager* Rounds = GetWorld()->SpawnActor<AFPSRoundManager>();
    AFPSPlayerCharacter* Player = GetWorld()->SpawnActor<AFPSPlayerCharacter>(FVector(-500, 0, 150), FRotator::ZeroRotator);
    AFPSPlayerController* Controller = GetWorld()->SpawnActor<AFPSPlayerController>();
    if (!Orders || !Roles || !Teams || !Tactics || !State || !Rounds || !Player || !Controller)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=manager_spawn"));
        return;
    }

    Player->Team = EFPS_Team::Attackers;
    Controller->Possess(Player);
    Controller->ConfigureTeamSystems(Teams, Orders);
    Teams->RegisterCombatant(Player);
    TArray<AFPSAIController*> Controllers;
    for (int32 Index = 0; Index < 3; ++Index)
    {
        AFPSBotCharacter* Bot = GetWorld()->SpawnActor<AFPSBotCharacter>(FVector(-200, Index * 150, 150), FRotator::ZeroRotator);
        AFPSAIController* BotController = GetWorld()->SpawnActor<AFPSAIController>();
        if (!Bot || !BotController)
        {
            UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=bot_spawn"));
            return;
        }
        Bot->Team = EFPS_Team::Attackers;
        BotController->Possess(Bot);
        Teams->RegisterCombatant(Bot);
        Controllers.Add(BotController);
    }

    Roles->AssignRoles(Controllers);
    if (Controllers[0]->BotRole != EFPS_BotRole::Assault
        || Controllers[1]->BotRole != EFPS_BotRole::Support
        || Controllers[2]->BotRole != EFPS_BotRole::Defender)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=roles"));
        return;
    }

    const FVector OrderTarget(125.0f, 250.0f, 0.0f);
    for (AFPSAIController* BotController : Controllers)
    {
        BotController->ConfigureTeamOrders(Orders);
    }
    if (!Controller->IssueTeamOrder(EFPS_TeamOrder::AttackTarget, OrderTarget, EFPS_RoundPhase::Combat, 10.0f)
        || Orders->CurrentOrder != EFPS_TeamOrder::AttackTarget
        || Orders->Issuer != Player
        || !Orders->TargetLocation.Equals(OrderTarget)
        || !Orders->IsOrderActive(EFPS_RoundPhase::Combat))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=team_order"));
        return;
    }
    const EPathFollowingStatus::Type MoveStatusBeforeOrder = Controllers[0]->GetMoveStatus();
    if (!Controllers[0]->bHasActiveTeamOrder || Controllers[0]->CurrentTeamOrder != EFPS_TeamOrder::AttackTarget
        || !Controllers[0]->DirectiveLocation.Equals(OrderTarget)
        || Controllers[0]->GetMoveStatus() != MoveStatusBeforeOrder)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=ai_order_resolution"));
        return;
    }
    for (EFPS_TeamOrder Order : {EFPS_TeamOrder::FollowPlayer, EFPS_TeamOrder::HoldHere, EFPS_TeamOrder::Retreat})
    {
        if (!Controller->IssueTeamOrder(Order, OrderTarget, EFPS_RoundPhase::Combat, 10.0f)
            || !Controllers[0]->bHasActiveTeamOrder || Controllers[0]->CurrentTeamOrder != Order
            || Controllers[0]->GetMoveStatus() != MoveStatusBeforeOrder)
        {
            UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=command_matrix order=%d"), static_cast<int32>(Order));
            return;
        }
    }

    AFPSBotCharacter* Enemy = GetWorld()->SpawnActor<AFPSBotCharacter>(FVector(500, 500, 150), FRotator::ZeroRotator);
    if (!Enemy)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=enemy_spawn"));
        return;
    }
    Enemy->Team = EFPS_Team::Defenders;
    Teams->RegisterCombatant(Enemy);
    const TArray<AFPSCharacterBase*> SpectatorTargets = Controller->GetLivingFriendlySpectatorTargets();
    if (SpectatorTargets.Num() != 3 || SpectatorTargets.Contains(Enemy))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=spectator_team_filter"));
        return;
    }
    Player->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Enemy);
    if (!Controller->IsInTeamSpectatorMode() || !Controller->GetSpectatorTarget()
        || Cast<AFPSCharacterBase>(Controller->GetSpectatorTarget())->Team != EFPS_Team::Attackers)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=spectator_entry"));
        return;
    }

    AFPSTacticalPoint* Attack = GetWorld()->SpawnActor<AFPSTacticalPoint>(FVector(500, 0, 100), FRotator::ZeroRotator);
    AFPSTacticalPoint* Guard = GetWorld()->SpawnActor<AFPSTacticalPoint>(FVector(-500, 0, 100), FRotator::ZeroRotator);
    if (!Attack || !Guard)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=tactical_spawn"));
        return;
    }
    Attack->PointType = EFPS_TacticalPointType::AttackPoint;
    Attack->PreferredRole = EFPS_BotRole::Assault;
    Guard->PointType = EFPS_TacticalPointType::GuardPoint;
    Guard->PreferredRole = EFPS_BotRole::Defender;
    const bool bAssaultResolved = Controllers[0]->ResolveRoleDirective(Tactics, Teams, Player);
    const bool bSupportResolved = Controllers[1]->ResolveRoleDirective(Tactics, Teams, Player);
    const bool bDefenderResolved = Controllers[2]->ResolveRoleDirective(Tactics, Teams, Player);
    const AFPSTacticalPoint* AssaultPoint = Cast<AFPSTacticalPoint>(Controllers[0]->DirectiveTarget);
    const AFPSTacticalPoint* DefenderPoint = Cast<AFPSTacticalPoint>(Controllers[2]->DirectiveTarget);
    if (!bAssaultResolved || !AssaultPoint || AssaultPoint->PointType != EFPS_TacticalPointType::AttackPoint
        || !bSupportResolved || Controllers[1]->FollowTarget != Controllers[0]->GetPawn()
        || !bDefenderResolved || !DefenderPoint || DefenderPoint->PointType != EFPS_TacticalPointType::GuardPoint)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=role_directives assault=%d assault_target=%s assault_type=%d support=%d support_target=%s defender=%d defender_target=%s defender_type=%d"),
            bAssaultResolved, *GetNameSafe(Controllers[0]->DirectiveTarget), AssaultPoint ? static_cast<int32>(AssaultPoint->PointType) : -1,
            bSupportResolved, *GetNameSafe(Controllers[1]->FollowTarget), bDefenderResolved,
            *GetNameSafe(Controllers[2]->DirectiveTarget), DefenderPoint ? static_cast<int32>(DefenderPoint->PointType) : -1);
        return;
    }
    for (AFPSAIController* FriendlyController : Controllers)
    {
        Cast<AFPSCharacterBase>(FriendlyController->GetPawn())->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Enemy);
    }
    Controller->CycleSpectatorTarget(1);
    if (!Controller->GetSpectatorTarget() || !Controller->GetSpectatorTarget()->ActorHasTag(TEXT("FixedSpectatorCamera"))
        || Cast<AFPSCharacterBase>(Controller->GetSpectatorTarget()))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=fixed_camera_fallback"));
        return;
    }

    Rounds->ConfigureManagers(State, Teams, Orders);
    FFPSMatchRules Rules;
    Rules.TeamSize = 3;
    Rules.RoundsToWin = 5;
    Rules.SwitchSidesAfterRound = 100;
    Rounds->StartMatch(Rules);
    Rounds->ResetAllCombatants();
    if (Orders->Issuer || Orders->IsOrderActive(EFPS_RoundPhase::Preparation) || Controllers[0]->bHasActiveTeamOrder)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=order_reset"));
        return;
    }
    if (Controllers[1]->FollowTarget != Player)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=support_player_follow"));
        return;
    }

    for (int32 Win = 1; Win <= 5; ++Win)
    {
        Rounds->StartCombatPhase();
        Enemy->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Player);
        if (Win < 5)
        {
            Rounds->StartNextRound();
        }
    }
    if (State->AttackersScore != 5 || State->RoundPhase != EFPS_RoundPhase::MatchResult)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=five_win_match"));
        return;
    }

    if (Teams->RegisterCombatant(Cast<AFPSCharacterBase>(Controllers[0]->GetPawn())))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_3V3_ELIMINATION_FAILED reason=duplicate_registration"));
        return;
    }

    UE_LOG(LogTemp, Display, TEXT("FPS_3V3_ELIMINATION_OK roles=assault_support_defender commands=manager_only reset=clear spectator=friendly_only duplicate_registration=rejected rounds_to_win=5 match_result=attackers"));
}
