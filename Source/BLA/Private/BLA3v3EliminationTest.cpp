#include "BLA3v3EliminationTest.h"

#include "BLAAIController.h"
#include "Camera/CameraActor.h"
#include "BLACharacterBase.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLAPlayerController.h"
#include "BLARoleAssignment.h"
#include "BLARoundManager.h"
#include "BLATacticalManager.h"
#include "BLATacticalPoint.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"

ABLA3v3EliminationTest::ABLA3v3EliminationTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ABLA3v3EliminationTest::BeginPlay()
{
    Super::BeginPlay();

    ABLATeamOrderManager* Orders = GetWorld()->SpawnActor<ABLATeamOrderManager>();
    ABLARoleAssignment* Roles = GetWorld()->SpawnActor<ABLARoleAssignment>();
    ABLATeamManager* Teams = GetWorld()->SpawnActor<ABLATeamManager>();
    ABLATacticalManager* Tactics = GetWorld()->SpawnActor<ABLATacticalManager>();
    ABLAGameState* State = GetWorld()->SpawnActor<ABLAGameState>();
    ABLARoundManager* Rounds = GetWorld()->SpawnActor<ABLARoundManager>();
    ABLAPlayerCharacter* Player = GetWorld()->SpawnActor<ABLAPlayerCharacter>(FVector(-500, 0, 150), FRotator::ZeroRotator);
    ABLAPlayerController* Controller = GetWorld()->SpawnActor<ABLAPlayerController>();
    if (!Orders || !Roles || !Teams || !Tactics || !State || !Rounds || !Player || !Controller)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=manager_spawn"));
        return;
    }

    Player->Team = EBLA_Team::Attackers;
    Controller->Possess(Player);
    Controller->ConfigureTeamSystems(Teams, Orders);
    Teams->RegisterCombatant(Player);
    TArray<ABLAAIController*> Controllers;
    for (int32 Index = 0; Index < 3; ++Index)
    {
        ABLABotCharacter* Bot = GetWorld()->SpawnActor<ABLABotCharacter>(FVector(-200, Index * 150, 150), FRotator::ZeroRotator);
        ABLAAIController* BotController = GetWorld()->SpawnActor<ABLAAIController>();
        if (!Bot || !BotController)
        {
            UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=bot_spawn"));
            return;
        }
        Bot->Team = EBLA_Team::Attackers;
        BotController->Possess(Bot);
        Teams->RegisterCombatant(Bot);
        Controllers.Add(BotController);
    }

    Roles->AssignRoles(Controllers);
    if (Controllers[0]->BotRole != EBLA_BotRole::Assault
        || Controllers[1]->BotRole != EBLA_BotRole::Support
        || Controllers[2]->BotRole != EBLA_BotRole::Defender)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=roles"));
        return;
    }

    const FVector OrderTarget(125.0f, 250.0f, 0.0f);
    for (ABLAAIController* BotController : Controllers)
    {
        BotController->ConfigureTeamOrders(Orders);
    }
    if (!Controller->IssueTeamOrder(EBLA_TeamOrder::AttackTarget, OrderTarget, EBLA_RoundPhase::Combat, 10.0f)
        || Orders->CurrentOrder != EBLA_TeamOrder::AttackTarget
        || Orders->Issuer != Player
        || !Orders->TargetLocation.Equals(OrderTarget)
        || !Orders->IsOrderActive(EBLA_RoundPhase::Combat))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=team_order"));
        return;
    }
    const EPathFollowingStatus::Type MoveStatusBeforeOrder = Controllers[0]->GetMoveStatus();
    if (!Controllers[0]->bHasActiveTeamOrder || Controllers[0]->CurrentTeamOrder != EBLA_TeamOrder::AttackTarget
        || !Controllers[0]->DirectiveLocation.Equals(OrderTarget)
        || Controllers[0]->GetMoveStatus() != MoveStatusBeforeOrder)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=ai_order_resolution"));
        return;
    }
    for (EBLA_TeamOrder Order : {EBLA_TeamOrder::FollowPlayer, EBLA_TeamOrder::HoldHere, EBLA_TeamOrder::Retreat})
    {
        if (!Controller->IssueTeamOrder(Order, OrderTarget, EBLA_RoundPhase::Combat, 10.0f)
            || !Controllers[0]->bHasActiveTeamOrder || Controllers[0]->CurrentTeamOrder != Order
            || Controllers[0]->GetMoveStatus() != MoveStatusBeforeOrder)
        {
            UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=command_matrix order=%d"), static_cast<int32>(Order));
            return;
        }
    }

    ABLABotCharacter* Enemy = GetWorld()->SpawnActor<ABLABotCharacter>(FVector(500, 500, 150), FRotator::ZeroRotator);
    if (!Enemy)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=enemy_spawn"));
        return;
    }
    Enemy->Team = EBLA_Team::Defenders;
    Teams->RegisterCombatant(Enemy);
    const TArray<ABLACharacterBase*> SpectatorTargets = Controller->GetLivingFriendlySpectatorTargets();
    if (SpectatorTargets.Num() != 3 || SpectatorTargets.Contains(Enemy))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=spectator_team_filter"));
        return;
    }
    Player->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Enemy);
    if (!Controller->IsInTeamSpectatorMode() || !Controller->GetSpectatorTarget()
        || Cast<ABLACharacterBase>(Controller->GetSpectatorTarget())->Team != EBLA_Team::Attackers)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=spectator_entry"));
        return;
    }

    ABLATacticalPoint* Attack = GetWorld()->SpawnActor<ABLATacticalPoint>(FVector(500, 0, 100), FRotator::ZeroRotator);
    ABLATacticalPoint* Guard = GetWorld()->SpawnActor<ABLATacticalPoint>(FVector(-500, 0, 100), FRotator::ZeroRotator);
    if (!Attack || !Guard)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=tactical_spawn"));
        return;
    }
    Attack->PointType = EBLA_TacticalPointType::AttackPoint;
    Attack->PreferredRole = EBLA_BotRole::Assault;
    Guard->PointType = EBLA_TacticalPointType::GuardPoint;
    Guard->PreferredRole = EBLA_BotRole::Defender;

    // Deterministic difficulty for the role assertions; the probability gates are
    // asserted on their own below.
    UBLABotDifficultyDataAsset* DeterministicDifficulty = NewObject<UBLABotDifficultyDataAsset>(this);
    DeterministicDifficulty->Difficulty.AimErrorDegrees = 4.0f;
    DeterministicDifficulty->Difficulty.VisionReactionSeconds = 0.0f;
    DeterministicDifficulty->Difficulty.FireDelaySeconds = 0.0f;
    DeterministicDifficulty->Difficulty.TacticalExecutionProbability = 1.0f;
    DeterministicDifficulty->Difficulty.TeamAssistProbability = 1.0f;
    for (ABLAAIController* BotController : Controllers)
    {
        BotController->ApplyDifficulty(DeterministicDifficulty);
    }

    const bool bAssaultResolved = Controllers[0]->ResolveRoleDirective(Tactics, Teams, Player);
    const bool bSupportResolved = Controllers[1]->ResolveRoleDirective(Tactics, Teams, Player);
    const bool bDefenderResolved = Controllers[2]->ResolveRoleDirective(Tactics, Teams, Player);
    const ABLATacticalPoint* AssaultPoint = Cast<ABLATacticalPoint>(Controllers[0]->DirectiveTarget);
    const ABLATacticalPoint* DefenderPoint = Cast<ABLATacticalPoint>(Controllers[2]->DirectiveTarget);
    if (!bAssaultResolved || !AssaultPoint || AssaultPoint->PointType != EBLA_TacticalPointType::AttackPoint
        || !bSupportResolved || Controllers[1]->FollowTarget != Controllers[0]->GetPawn()
        || !bDefenderResolved || !DefenderPoint || DefenderPoint->PointType != EBLA_TacticalPointType::GuardPoint)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=role_directives assault=%d assault_target=%s assault_type=%d support=%d support_target=%s defender=%d defender_target=%s defender_type=%d"),
            bAssaultResolved, *GetNameSafe(Controllers[0]->DirectiveTarget), AssaultPoint ? static_cast<int32>(AssaultPoint->PointType) : -1,
            bSupportResolved, *GetNameSafe(Controllers[1]->FollowTarget), bDefenderResolved,
            *GetNameSafe(Controllers[2]->DirectiveTarget), DefenderPoint ? static_cast<int32>(DefenderPoint->PointType) : -1);
        return;
    }

    // Difficulty: the two probability knobs must be able to change the directive without
    // ever leaving a bot without one.
    UBLABotDifficultyDataAsset* IndependentDifficulty = NewObject<UBLABotDifficultyDataAsset>(this);
    IndependentDifficulty->Difficulty.AimErrorDegrees = 4.0f;
    IndependentDifficulty->Difficulty.VisionReactionSeconds = 0.0f;
    IndependentDifficulty->Difficulty.FireDelaySeconds = 0.0f;
    IndependentDifficulty->Difficulty.TacticalExecutionProbability = 0.0f;
    IndependentDifficulty->Difficulty.TeamAssistProbability = 0.0f;
    for (ABLAAIController* BotController : Controllers)
    {
        BotController->ApplyDifficulty(IndependentDifficulty);
    }
    const bool bAssaultFallsBack = Controllers[0]->ResolveRoleDirective(Tactics, Teams, Player)
        && Controllers[0]->DirectiveTarget == nullptr && Controllers[0]->FollowTarget != nullptr;
    const bool bSupportTakesOwnPoint = Controllers[1]->ResolveRoleDirective(Tactics, Teams, Player)
        && Controllers[1]->FollowTarget == nullptr
        && Cast<ABLATacticalPoint>(Controllers[1]->DirectiveTarget) != nullptr;
    const bool bDefenderFallsBack = Controllers[2]->ResolveRoleDirective(Tactics, Teams, Player)
        && Controllers[2]->DirectiveTarget == nullptr && Controllers[2]->FollowTarget != nullptr;
    if (!bAssaultFallsBack || !bSupportTakesOwnPoint || !bDefenderFallsBack)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=difficulty_probabilities assault=%d support=%d defender=%d"),
            bAssaultFallsBack, bSupportTakesOwnPoint, bDefenderFallsBack);
        return;
    }

    // Restore the deterministic difficulty: later automatic re-resolutions (round reset,
    // order cleared) must keep the team-follow behaviour the remaining assertions expect.
    for (ABLAAIController* BotController : Controllers)
    {
        BotController->ApplyDifficulty(DeterministicDifficulty);
    }

    for (ABLAAIController* FriendlyController : Controllers)
    {
        Cast<ABLACharacterBase>(FriendlyController->GetPawn())->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Enemy);
    }
    Controller->CycleSpectatorTarget(1);
    if (!Controller->GetSpectatorTarget() || !Controller->GetSpectatorTarget()->ActorHasTag(TEXT("FixedSpectatorCamera"))
        || Cast<ABLACharacterBase>(Controller->GetSpectatorTarget()))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=fixed_camera_fallback"));
        return;
    }

    Rounds->ConfigureManagers(State, Teams, Orders);
    FBLAMatchRules Rules;
    Rules.TeamSize = 3;
    Rules.RoundsToWin = 5;
    Rules.SwitchSidesAfterRound = 100;
    Rounds->StartMatch(Rules);
    Rounds->ResetAllCombatants();
    if (Orders->Issuer || Orders->IsOrderActive(EBLA_RoundPhase::Preparation) || Controllers[0]->bHasActiveTeamOrder)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=order_reset"));
        return;
    }
    if (Controllers[1]->FollowTarget != Player)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=support_player_follow"));
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
    if (State->AttackersScore != 5 || State->RoundPhase != EBLA_RoundPhase::MatchResult)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=five_win_match"));
        return;
    }

    if (Teams->RegisterCombatant(Cast<ABLACharacterBase>(Controllers[0]->GetPawn())))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_3V3_ELIMINATION_FAILED reason=duplicate_registration"));
        return;
    }

    UE_LOG(LogTemp, Display, TEXT("BLA_3V3_ELIMINATION_OK roles=assault_support_defender commands=manager_only reset=clear spectator=friendly_only duplicate_registration=rejected rounds_to_win=5 match_result=attackers"));
}
