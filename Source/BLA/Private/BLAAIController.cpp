#include "BLAAIController.h"

#include "BehaviorTree/BehaviorTree.h"
#include "BLABotPerception.h"
#include "BLACharacterBase.h"
#include "BLADataCore.h"
#include "BLADebugSubsystem.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLAObjectiveManager.h"
#include "BLAObjectiveZone.h"
#include "BLASpawnPoint.h"
#include "BLATacticalManager.h"
#include "BLATacticalPoint.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "BLAWeaponComponent.h"
#include "EngineUtils.h"
#include "Navigation/PathFollowingComponent.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Damage.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Perception/AISenseConfig_Sight.h"
#include "Perception/AIPerceptionSystem.h"
#include "Perception/AISense_Damage.h"
#include "Perception/AISense_Hearing.h"

namespace
{
    constexpr float DirectiveMoveRefreshDistance = 150.0f;
    constexpr float DirectiveRefreshSeconds = 5.0f;
    constexpr float TargetScanInterval = 0.3f;
    constexpr float ApproachArrivalDistance = 150.0f;
    constexpr float ApproachAdvantageDistance = 150.0f;
    constexpr float LaneSplitY = 250.0f;

    int32 LaneIndexFromY(float Y)
    {
        return Y < -LaneSplitY ? 0 : Y > LaneSplitY ? 2 : 1;
    }
}

ABLAAIController::ABLAAIController()
{
    PrimaryActorTick.bCanEverTick = true;
    AIPerception = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("AIPerception"));
    BotPerception = CreateDefaultSubobject<UBLABotPerception>(TEXT("BotPerception"));

    UAISenseConfig_Sight* Sight = CreateDefaultSubobject<UAISenseConfig_Sight>(TEXT("SightConfig"));
    Sight->SightRadius = 3000.0f;
    Sight->LoseSightRadius = 3500.0f;
    Sight->PeripheralVisionAngleDegrees = 70.0f;
    Sight->DetectionByAffiliation.bDetectEnemies = true;
    Sight->DetectionByAffiliation.bDetectFriendlies = false;
    Sight->DetectionByAffiliation.bDetectNeutrals = false;
    AIPerception->ConfigureSense(*Sight);
    AIPerception->ConfigureSense(*CreateDefaultSubobject<UAISenseConfig_Hearing>(TEXT("HearingConfig")));
    AIPerception->ConfigureSense(*CreateDefaultSubobject<UAISenseConfig_Damage>(TEXT("DamageConfig")));
    AIPerception->SetDominantSense(Sight->GetSenseImplementation());
    AIPerception->OnTargetPerceptionUpdated.AddDynamic(this, &ABLAAIController::HandleTargetPerceptionUpdated);
}

void ABLAAIController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);
    LastStuckCheckLocation = InPawn ? InPawn->GetActorLocation() : FVector::ZeroVector;
    if (EliminationTree)
    {
        RunBehaviorTree(EliminationTree);
    }
}

void ABLAAIController::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    UpdateTargetMemory();
    ScanForTargets();
    UpdateDirectiveFromSources(DeltaSeconds);
    TickCombat();
    TickMovement();
    APawn* ControlledPawn = GetPawn();
    if (ControlledPawn && ObjectiveManager)
    {
        const EBLA_ObjectiveState ObjectiveState = ObjectiveManager->ObjectiveState;
        if (ObjectiveState != EBLA_ObjectiveState::None
            && ObjectiveState != EBLA_ObjectiveState::Defused
            && ObjectiveState != EBLA_ObjectiveState::Completed)
        {
            ResolveObjectiveDirective(ObjectiveManager, ObjectiveTacticalManager, nullptr);
        }
    }
    if (!ControlledPawn || GetMoveStatus() != EPathFollowingStatus::Moving)
    {
        StuckElapsed = 0.0f;
        bIsStuck = false;
        return;
    }
    StuckElapsed += DeltaSeconds;
    if (StuckElapsed >= 0.5f)
    {
        bIsStuck = FVector::DistSquared2D(LastStuckCheckLocation, ControlledPawn->GetActorLocation()) < 25.0f;
        LastStuckCheckLocation = ControlledPawn->GetActorLocation();
        StuckElapsed = 0.0f;
    }
}

bool ABLAAIController::UpdateTarget(AActor* Candidate, EBLA_StimulusType StimulusType)
{
    ABLACharacterBase* Observer = Cast<ABLACharacterBase>(GetPawn());
    if (!Observer || !Candidate || !BotPerception)
    {
        return false;
    }
    if (StimulusType == EBLA_StimulusType::Sight && !HasClearShot(Candidate))
    {
        return false;
    }
    AActor* PreviousTarget = BotPerception->TargetActor;
    if (!BotPerception->ReportStimulus(Observer, Candidate, StimulusType, Candidate->GetActorLocation()))
    {
        return false;
    }
    if (PreviousTarget != Candidate)
    {
        // Difficulty: a fresh target needs VisionReactionSeconds before the bot may fire.
        TargetAcquiredTime = GetWorld() ? GetWorld()->GetTimeSeconds() : -1.0;
    }
    TargetLostTime = -1.0;
    bTargetLost = false;
    return true;
}

bool ABLAAIController::AimAndFireAtTarget()
{
    ABLACharacterBase* Shooter = Cast<ABLACharacterBase>(GetPawn());
    ABLACharacterBase* Target = BotPerception ? Cast<ABLACharacterBase>(BotPerception->TargetActor) : nullptr;
    if (!Shooter || !Target || !Shooter->GetIsAlive() || !Target->GetIsAlive() || Shooter->Team == Target->Team
        || !Shooter->WeaponComponent || !Shooter->WeaponComponent->CanFire() || !HasClearShot(Target))
    {
        return false;
    }
    const double Now = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.0;
    if (TargetAcquiredTime < 0.0)
    {
        TargetAcquiredTime = Now;
    }
    if (Now - TargetAcquiredTime < AppliedVisionReactionSeconds)
    {
        return false;
    }
    if (!IsFireDelayElapsed())
    {
        return false;
    }
    const FVector Start = Shooter->GetActorLocation() + FVector(0.0f, 0.0f, 45.0f);
    const FVector TargetLocation = Target->GetActorLocation() + FVector(0.0f, 0.0f, 45.0f);
    if (FVector::Dist(Start, TargetLocation) > MaxEngagementDistance)
    {
        return false;
    }
    // Spread the shot around the aim direction instead of biasing every bot to the same
    // side: a fixed sign turns the difficulty's aim error into a systematic miss.
    const float AimErrorYaw = FMath::FRandRange(-AppliedAimErrorDegrees, AppliedAimErrorDegrees);
    const FVector Direction = ((TargetLocation - Start).Rotation() + FRotator(0.0f, AimErrorYaw, 0.0f)).Vector();
    const bool bFired = Shooter->WeaponComponent->FireWeapon(Start, Direction);
    if (bFired)
    {
        LastFireTime = Now;
    }
    return bFired;
}

bool ABLAAIController::IsFireDelayElapsed() const
{
    if (!GetWorld() || LastFireTime < 0.0)
    {
        return true;
    }
    return GetWorld()->GetTimeSeconds() - LastFireTime >= AppliedFireDelaySeconds;
}

void ABLAAIController::ApplyDifficulty(UBLABotDifficultyDataAsset* InDifficulty)
{
    DifficultyAsset = InDifficulty;
    if (!DifficultyAsset)
    {
        return;
    }
    const FBLABotDifficulty& Difficulty = DifficultyAsset->Difficulty;
    AppliedAimErrorDegrees = FMath::Max(0.1f, Difficulty.AimErrorDegrees);
    AppliedVisionReactionSeconds = FMath::Max(0.0f, Difficulty.VisionReactionSeconds);
    AppliedFireDelaySeconds = FMath::Max(0.0f, Difficulty.FireDelaySeconds);
    AppliedSearchSeconds = FMath::Max(0.0f, Difficulty.SearchSeconds);
    AppliedTacticalExecutionProbability = FMath::Clamp(Difficulty.TacticalExecutionProbability, 0.0f, 1.0f);
    AppliedTeamAssistProbability = FMath::Clamp(Difficulty.TeamAssistProbability, 0.0f, 1.0f);
    if (BotPerception)
    {
        BotPerception->HearingRadius = FMath::Max(0.0f, Difficulty.HearingRadius);
    }
}

void ABLAAIController::UpdateTargetMemory()
{
    if (!BotPerception || !GetWorld())
    {
        return;
    }
    AActor* Target = BotPerception->TargetActor;
    if (!Target)
    {
        TargetLostTime = -1.0;
        bTargetLost = false;
        return;
    }
    const ABLACharacterBase* TargetCombatant = Cast<ABLACharacterBase>(Target);
    const bool bTargetVisible = TargetCombatant && TargetCombatant->GetIsAlive() && HasClearShot(Target);
    if (bTargetVisible)
    {
        TargetLostTime = -1.0;
        bTargetLost = false;
        return;
    }
    // Difficulty: keep searching the last known position for SearchSeconds, then forget it.
    if (TargetLostTime < 0.0)
    {
        TargetLostTime = GetWorld()->GetTimeSeconds();
        bTargetLost = true;
        return;
    }
    if (GetWorld()->GetTimeSeconds() - TargetLostTime >= AppliedSearchSeconds)
    {
        BotPerception->ForgetTarget();
        TargetLostTime = -1.0;
        TargetAcquiredTime = -1.0;
        bTargetLost = false;
    }
}

void ABLAAIController::ScanForTargets()
{
    if (!BotPerception || BotPerception->TargetActor || !GetWorld())
    {
        return;
    }
    ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!Bot || !Bot->GetIsAlive())
    {
        return;
    }
    const double Now = GetWorld()->GetTimeSeconds();
    if (LastTargetScanTime >= 0.0 && Now - LastTargetScanTime < TargetScanInterval)
    {
        return;
    }
    LastTargetScanTime = Now;

    // Deterministic sight pass: the AI perception component still handles hearing and
    // damage stimuli, but target acquisition is owned here so the live loop is testable.
    ABLACharacterBase* Best = nullptr;
    float BestDistance = TNumericLimits<float>::Max();
    for (TActorIterator<ABLACharacterBase> It(GetWorld()); It; ++It)
    {
        ABLACharacterBase* Candidate = *It;
        if (!Candidate || Candidate == Bot || !Candidate->GetIsAlive()
            || Candidate->Team == Bot->Team || Candidate->Team == EBLA_Team::Neutral)
        {
            continue;
        }
        const float Distance = FVector::Dist(Bot->GetActorLocation(), Candidate->GetActorLocation());
        if (Distance > SightRadius || Distance >= BestDistance || !HasClearShot(Candidate))
        {
            continue;
        }
        Best = Candidate;
        BestDistance = Distance;
    }
    if (Best)
    {
        UpdateTarget(Best, EBLA_StimulusType::Sight);
    }
}

bool ABLAAIController::HasClearShot(const AActor* Candidate) const
{
    const APawn* Bot = GetPawn();
    if (!Candidate || !Bot || !GetWorld())
    {
        return false;
    }
    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(BLASightScan), false, Bot);
    Params.AddIgnoredActor(Candidate);
    const bool bBlocked = GetWorld()->LineTraceSingleByChannel(
        Hit,
        Bot->GetActorLocation() + FVector(0.0f, 0.0f, 60.0f),
        Candidate->GetActorLocation() + FVector(0.0f, 0.0f, 60.0f),
        ECC_Visibility, Params);
    return !bBlocked;
}

AActor* ABLAAIController::ResolveAssistTarget(ABLATeamManager* TeamManager, AActor* PlayerActor)
{
    ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!TeamManager || !Bot)
    {
        return nullptr;
    }
    ABLACharacterBase* PreferredPlayer = Cast<ABLACharacterBase>(PlayerActor);
    if (PreferredPlayer && PreferredPlayer->Team == Bot->Team && PreferredPlayer->GetIsAlive())
    {
        return PreferredPlayer;
    }
    ABLACharacterBase* BestFriendly = nullptr;
    int32 BestPriority = -1;
    for (ABLACharacterBase* Friendly : TeamManager->GetTeamMembers(Bot->Team))
    {
        if (!Friendly || Friendly == Bot || !Friendly->GetIsAlive())
        {
            continue;
        }
        const ABLAAIController* FriendlyAI = Cast<ABLAAIController>(Friendly->GetController());
        const int32 Priority = !FriendlyAI ? 4
            : FriendlyAI->BotRole == EBLA_BotRole::Assault ? 3
            : FriendlyAI->BotRole == EBLA_BotRole::Support ? 2 : 1;
        if (Priority > BestPriority)
        {
            BestPriority = Priority;
            BestFriendly = Friendly;
        }
    }
    return BestFriendly;
}

void ABLAAIController::HandleTargetPerceptionUpdated(AActor* Actor, FAIStimulus Stimulus)
{
    if (!Actor || !Stimulus.WasSuccessfullySensed())
    {
        return;
    }
    EBLA_StimulusType Type = EBLA_StimulusType::Sight;
    const TSubclassOf<UAISense> SenseClass = UAIPerceptionSystem::GetSenseClassForStimulus(this, Stimulus);
    if (SenseClass == UAISense_Hearing::StaticClass())
    {
        Type = EBLA_StimulusType::Hearing;
    }
    else if (SenseClass == UAISense_Damage::StaticClass())
    {
        Type = EBLA_StimulusType::Damage;
    }
    UpdateTarget(Actor, Type);
}

void ABLAAIController::UpdateDirectiveFromSources(float DeltaSeconds)
{
    const ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
    const EBLA_RoundPhase Phase = State ? State->RoundPhase : EBLA_RoundPhase::Combat;
    if (TeamOrderManager && TeamOrderManager->IsOrderActive(Phase))
    {
        ResolveTeamOrder(TeamOrderManager, Phase);
        return;
    }
    bHasActiveTeamOrder = false;

    if (ObjectiveManager && ObjectiveManager->ObjectiveState != EBLA_ObjectiveState::None
        && ObjectiveManager->ObjectiveState != EBLA_ObjectiveState::Defused
        && ObjectiveManager->ObjectiveState != EBLA_ObjectiveState::Completed)
    {
        // The objective directive issues its own rate-limited moves and holds position
        // while a plant/defuse runs.
        bObjectiveOwnsMovement = true;
        ResolveObjectiveDirective(ObjectiveManager, ObjectiveTacticalManager, RolePlayerActor);
        return;
    }
    bObjectiveOwnsMovement = false;

    DirectiveRefreshElapsed += DeltaSeconds;
    const bool bNeedsDirective = !IsValid(DirectiveTarget) && !IsValid(FollowTarget);
    if ((bNeedsDirective || DirectiveRefreshElapsed >= DirectiveRefreshSeconds) && RoleTacticalManager && RoleTeamManager)
    {
        DirectiveRefreshElapsed = 0.0f;
        ResolveRoleDirective(RoleTacticalManager, RoleTeamManager, RolePlayerActor);
    }
}

void ABLAAIController::TickCombat()
{
    const ABLAGameState* State = GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
    if (State && State->RoundPhase != EBLA_RoundPhase::Combat)
    {
        if (State->RoundPhase == EBLA_RoundPhase::Preparation)
        {
            StuckRecoveryCount = 0;
            LastRecoveryPoint = nullptr;
            bRecoveryMoveActive = false;
            if (RoleTacticalManager && ReservedPoint)
            {
                RoleTacticalManager->ReleasePoint(ReservedPoint);
                ReservedPoint = nullptr;
            }
        }
        // Bots hold fire outside combat; movement and directives keep running.
        return;
    }
    if (BotPerception && BotPerception->TargetActor)
    {
        AimAndFireAtTarget();
    }
}

void ABLAAIController::TickMovement()
{
    const ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!Bot || !Bot->GetIsAlive())
    {
        return;
    }
    const bool bHoldInteraction = ObjectiveManager
        && (ObjectiveManager->ObjectiveState == EBLA_ObjectiveState::Planting
            || ObjectiveManager->ObjectiveState == EBLA_ObjectiveState::Defusing);
    ABLATacticalManager* RecoveryManager = RoleTacticalManager ? RoleTacticalManager.Get() : ObjectiveTacticalManager.Get();
    if (!bHoldInteraction && bIsStuck && RecoveryManager)
    {
        bIsStuck = false;
        bHasDirectiveMoveTarget = false;
        RecoverFromStuck(RecoveryManager);
        return;
    }
    if (!bHoldInteraction && bRecoveryMoveActive)
    {
        const FVector RecoveryLocation = LastRecoveryPoint ? LastRecoveryPoint->GetActorLocation() : DirectiveLocation;
        IssueDirectiveMove(RecoveryLocation, 50.0f);
        return;
    }
    if (bObjectiveOwnsMovement)
    {
        return;
    }
    if (bHasActiveTeamOrder)
    {
        IssueDirectiveMove(DirectiveLocation, 50.0f);
        return;
    }
    if (IsValid(DirectiveTarget))
    {
        IssueDirectiveMove(DirectiveTarget->GetActorLocation(), 50.0f);
        return;
    }
    if (IsValid(FollowTarget))
    {
        IssueDirectiveMove(FollowTarget->GetActorLocation(), 350.0f);
    }
}

void ABLAAIController::IssueDirectiveMove(const FVector& Location, float AcceptanceRadius)
{
    const bool bTargetMoved = !bHasDirectiveMoveTarget
        || FVector::DistSquared(Location, LastDirectiveMoveTarget) > FMath::Square(DirectiveMoveRefreshDistance);
    if (bTargetMoved || GetMoveStatus() != EPathFollowingStatus::Moving)
    {
        bHasDirectiveMoveTarget = true;
        LastDirectiveMoveTarget = Location;
        MoveToLocation(Location, AcceptanceRadius, true);
    }
}

bool ABLAAIController::MoveToTacticalPoint(ABLATacticalPoint* Point)
{
    return Point && MoveToLocation(Point->GetActorLocation(), 50.0f, true) != EPathFollowingRequestResult::Failed;
}

bool ABLAAIController::RecoverFromStuck(ABLATacticalManager* Manager)
{
    ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!Bot || !Manager)
    {
        return false;
    }
    bIsStuck = false;
    ++StuckRecoveryCount;
    RecoveryAttemptCount = StuckRecoveryCount;
    ABLASpawnPoint* SafeSpawn = nullptr;
    ABLATacticalPoint* Recovery = nullptr;
    if (StuckRecoveryCount > 2)
    {
        // Two failed recoveries in one round: fall back to the team's own spawn area.
        SafeSpawn = FindNearestTeamSpawn(Bot);
    }
    if (SafeSpawn)
    {
        // Spawn fallback is not a tactical point; clear the last point so TickMovement
        // and objective recovery keep walking to the spawn instead of the blocked point.
        LastRecoveryPoint = nullptr;
        DirectiveTarget = nullptr;
        DirectiveLocation = SafeSpawn->GetActorLocation();
        IssueDirectiveMove(DirectiveLocation, 50.0f);
        bRecoveryMoveActive = true;
    }
    else
    {
        Recovery = Manager->FindNearestReachablePoint(Bot, Bot->Team, LastRecoveryPoint);
        if (Recovery)
        {
            LastRecoveryPoint = Recovery;
            DirectiveTarget = Recovery;
            DirectiveLocation = Recovery->GetActorLocation();
            MoveToTacticalPoint(Recovery);
            bRecoveryMoveActive = true;
        }
    }
    if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
    {
        Debug->ReportEvent(TEXT("AI_STUCK_RECOVERED"),
            FString::Printf(TEXT("bot=%s point=%s attempts=%d fallback=%s"), *Bot->GetName(),
                SafeSpawn ? *SafeSpawn->GetName() : Recovery ? *Recovery->GetName() : TEXT("none"),
                StuckRecoveryCount, SafeSpawn ? TEXT("team_spawn") : TEXT("tactical_point")));
    }
    return SafeSpawn != nullptr || Recovery != nullptr;
}

ABLASpawnPoint* ABLAAIController::FindNearestTeamSpawn(const ABLACharacterBase* Bot) const
{
    if (!Bot || !GetWorld())
    {
        return nullptr;
    }
    ABLASpawnPoint* Best = nullptr;
    float BestDistance = TNumericLimits<float>::Max();
    for (TActorIterator<ABLASpawnPoint> It(GetWorld()); It; ++It)
    {
        if (It->Team != Bot->Team)
        {
            continue;
        }
        const float Distance = FVector::DistSquared2D(Bot->GetActorLocation(), It->GetActorLocation());
        if (Distance < BestDistance)
        {
            BestDistance = Distance;
            Best = *It;
        }
    }
    return Best;
}

bool ABLAAIController::ResolveRoleDirective(ABLATacticalManager* Manager, ABLATeamManager* TeamManager, AActor* PlayerActor)
{
    ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!Bot || !Manager || !TeamManager)
    {
        return false;
    }

    RoleTacticalManager = Manager;
    RoleTeamManager = TeamManager;
    RolePlayerActor = PlayerActor;

    DirectiveTarget = nullptr;
    FollowTarget = nullptr;
    // Release our own claim first so the point is a candidate again for this bot; the
    // reservation is re-applied below once the new directive is known.
    if (ReservedPoint)
    {
        Manager->ReleasePoint(ReservedPoint);
        ReservedPoint = nullptr;
    }
    // Difficulty knobs: TacticalExecutionProbability decides whether the bot commits to its
    // assigned tactical point, TeamAssistProbability whether a Support bot assists a teammate
    // instead of holding a point of its own. Failing either roll leaves the bot with a
    // fallback directive so it never stands idle.
    // Lane preference comes from the bot's stable slot inside its own team so a three-bot squad
    // spreads over the left, center and right routes instead of stacking on one choke.
    const int32 PreferredLane = ResolvePreferredLane(TeamManager);
    const bool bExecutesTactics = FMath::FRand() < AppliedTacticalExecutionProbability;
    if (BotRole == EBLA_BotRole::Assault || BotRole == EBLA_BotRole::Defender)
    {
        const EBLA_TacticalPointType PointType = BotRole == EBLA_BotRole::Assault
            ? EBLA_TacticalPointType::AttackPoint
            : EBLA_TacticalPointType::GuardPoint;
        if (bExecutesTactics)
        {
            DirectiveTarget = Manager->FindBestPoint(Bot, PointType, Bot->Team, BotRole, PreferredLane);
        }
        if (!DirectiveTarget)
        {
            FollowTarget = ResolveAssistTarget(TeamManager, PlayerActor);
        }
    }
    else
    {
        if (FMath::FRand() < AppliedTeamAssistProbability)
        {
            FollowTarget = ResolveAssistTarget(TeamManager, PlayerActor);
        }
        else
        {
            DirectiveTarget = Manager->FindBestPoint(Bot, EBLA_TacticalPointType::GuardPoint, Bot->Team, BotRole, PreferredLane);
            if (!DirectiveTarget)
            {
                DirectiveTarget = Manager->FindBestPoint(Bot, EBLA_TacticalPointType::RetreatPoint, Bot->Team, BotRole, PreferredLane);
            }
            if (!DirectiveTarget)
            {
                FollowTarget = ResolveAssistTarget(TeamManager, PlayerActor);
            }
        }
    }
    // Claim the chosen point so the rest of the team spreads over the other lanes instead of
    // stacking on one choke. Reservation lives with the controller and is released on the next
    // directive change and on the Preparation reset.
    if (ABLATacticalPoint* TargetPoint = Cast<ABLATacticalPoint>(DirectiveTarget))
    {
        if (Manager->ReservePoint(TargetPoint))
        {
            ReservedPoint = TargetPoint;
        }
    }
    return IsValid(DirectiveTarget) || IsValid(FollowTarget);
}

bool ABLAAIController::ResolveTeamOrder(ABLATeamOrderManager* OrderManager, EBLA_RoundPhase Phase)
{
    ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    const ABLACharacterBase* IssuerCombatant = OrderManager ? Cast<ABLACharacterBase>(OrderManager->Issuer) : nullptr;
    if (!Bot || !IssuerCombatant || Bot->Team != IssuerCombatant->Team || !OrderManager->IsOrderActive(Phase))
    {
        return false;
    }

    CurrentTeamOrder = OrderManager->CurrentOrder;
    DirectiveLocation = OrderManager->TargetLocation;
    DirectiveTarget = nullptr;
    FollowTarget = CurrentTeamOrder == EBLA_TeamOrder::FollowPlayer ? OrderManager->Issuer : nullptr;
    bHasActiveTeamOrder = true;
    return true;
}

void ABLAAIController::ConfigureTeamOrders(ABLATeamOrderManager* OrderManager)
{
    if (TeamOrderManager)
    {
        TeamOrderManager->OnOrderChanged.RemoveAll(this);
    }
    TeamOrderManager = OrderManager;
    if (TeamOrderManager)
    {
        TeamOrderManager->OnOrderChanged.AddUObject(this, &ABLAAIController::HandleTeamOrderChanged);
    }
}

void ABLAAIController::ConfigureObjective(ABLAObjectiveManager* InManager, ABLATacticalManager* InTacticalManager)
{
    ObjectiveManager = InManager;
    ObjectiveTacticalManager = InTacticalManager;
    if (!RoleTacticalManager && InTacticalManager)
    {
        RoleTacticalManager = InTacticalManager;
    }
    if (!RoleTeamManager && InManager)
    {
        RoleTeamManager = InManager->TeamManager;
    }
    CurrentObjectiveTask = NAME_None;
    bHasObjectiveDirective = false;
    bHasObjectiveMoveTarget = false;
}

int32 ABLAAIController::ResolvePreferredLane(ABLATeamManager* TeamManager) const
{
    const ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!Bot || !TeamManager)
    {
        return -1;
    }
    TArray<ABLACharacterBase*> Members = TeamManager->GetTeamMembers(Bot->Team);
    Members.RemoveAll([](const ABLACharacterBase* Member)
    {
        return Member == nullptr || Cast<ABLAAIController>(Member->GetController()) == nullptr;
    });
    Members.Sort([](const ABLACharacterBase& Left, const ABLACharacterBase& Right)
    {
        return Left.GetName() < Right.GetName();
    });
    const int32 Slot = Members.IndexOfByKey(Bot);
    return Slot >= 0 ? Slot % 3 : -1;
}

bool ABLAAIController::ResolveObjectiveDirective(ABLAObjectiveManager* InManager, ABLATacticalManager* InTacticalManager, AActor* PlayerActor)
{
    ABLACharacterBase* Bot = Cast<ABLACharacterBase>(GetPawn());
    if (!Bot || !InManager || !Bot->GetIsAlive())
    {
        bHasObjectiveDirective = false;
        DirectiveTarget = nullptr;
        CurrentObjectiveTask = NAME_None;
        return false;
    }
    ObjectiveManager = InManager;
    ObjectiveTacticalManager = InTacticalManager;
    if (!RoleTacticalManager && InTacticalManager)
    {
        RoleTacticalManager = InTacticalManager;
    }
    if (!RoleTeamManager && InManager)
    {
        RoleTeamManager = InManager->TeamManager;
    }
    DirectiveTarget = nullptr;
    FollowTarget = nullptr;
    bHasObjectiveDirective = false;
    CurrentObjectiveTask = NAME_None;

    ABLADataCore* Core = InManager->DataCore;
    ABLAObjectiveZone* Zone = InManager->ObjectiveZone;
    const EBLA_ObjectiveState ObjectiveState = InManager->ObjectiveState;
    const bool bPlanted = InManager->IsPlanted();
    const int32 PreferredLane = ResolvePreferredLane(RoleTeamManager);

    const auto MoveToDirective = [this](const FVector& Location)
    {
        bHasObjectiveDirective = true;
        DirectiveLocation = Location;
        const bool bTargetMoved = !bHasObjectiveMoveTarget
            || FVector::DistSquared(Location, LastObjectiveMoveTarget) > FMath::Square(DirectiveMoveRefreshDistance);
        if (bTargetMoved || GetMoveStatus() != EPathFollowingStatus::Moving)
        {
            bHasObjectiveMoveTarget = true;
            LastObjectiveMoveTarget = Location;
            MoveToLocation(Location, 50.0f, true);
        }
    };
    const auto ResolvePoint = [this, InTacticalManager, Bot, PreferredLane](EBLA_TacticalPointType Type)
    {
        return InTacticalManager ? InTacticalManager->FindBestPoint(Bot, Type, Bot->Team, BotRole, PreferredLane) : nullptr;
    };
    const auto ClaimPoint = [this, InTacticalManager]()
    {
        ABLATacticalPoint* TargetPoint = Cast<ABLATacticalPoint>(DirectiveTarget);
        if (!TargetPoint || !InTacticalManager || ReservedPoint == TargetPoint)
        {
            return;
        }
        if (ReservedPoint)
        {
            InTacticalManager->ReleasePoint(ReservedPoint);
            ReservedPoint = nullptr;
        }
        if (InTacticalManager->ReservePoint(TargetPoint))
        {
            ReservedPoint = TargetPoint;
        }
    };

    const bool bReadyToPlant = Core && Core->IsCarriedBy(Bot) && Zone && Zone->ContainsActor(Bot);
    const bool bHoldInteraction = ObjectiveState == EBLA_ObjectiveState::Planting
        || ObjectiveState == EBLA_ObjectiveState::Defusing
        || bReadyToPlant;
    if (!bHoldInteraction)
    {
        ABLATacticalManager* RecoveryManager = InTacticalManager ? InTacticalManager : RoleTacticalManager.Get();
        if (bIsStuck && RecoveryManager && RecoverFromStuck(RecoveryManager))
        {
            CurrentObjectiveTask = TEXT("Recover");
            DirectiveTarget = LastRecoveryPoint;
            const FVector RecoveryLocation = LastRecoveryPoint ? LastRecoveryPoint->GetActorLocation() : DirectiveLocation;
            MoveToDirective(RecoveryLocation);
            return true;
        }
        if (bRecoveryMoveActive)
        {
            const FVector RecoveryLocation = LastRecoveryPoint ? LastRecoveryPoint->GetActorLocation() : DirectiveLocation;
            if (FVector::Dist2D(Bot->GetActorLocation(), RecoveryLocation) > ApproachArrivalDistance)
            {
                CurrentObjectiveTask = TEXT("Recover");
                DirectiveTarget = LastRecoveryPoint;
                MoveToDirective(RecoveryLocation);
                return true;
            }
            bRecoveryMoveActive = false;
        }
    }

    if (Bot->Team == EBLA_Team::Attackers)
    {
        if (Core && Core->IsCarriedBy(Bot))
        {
            if (ObjectiveState == EBLA_ObjectiveState::Planting)
            {
                CurrentObjectiveTask = TEXT("Plant");
                return true;
            }
            if (Zone && Zone->ContainsActor(Bot))
            {
                CurrentObjectiveTask = TEXT("Plant");
                if (InManager->BeginPlant(Bot))
                {
                    // The objective manager cancels a timed interaction when the
                    // interactor moves; stop walking so the plant is not restarted.
                    StopMovement();
                    return true;
                }
            }
            DirectiveTarget = ResolvePoint(EBLA_TacticalPointType::PlantPoint);
            MoveToDirective(DirectiveTarget ? DirectiveTarget->GetActorLocation()
                : (Zone ? Zone->GetActorLocation() : Bot->GetActorLocation()));
            ClaimPoint();
            CurrentObjectiveTask = TEXT("CarryToPlant");
            return true;
        }
        if (Core && Core->CanBePickedUp())
        {
            CurrentObjectiveTask = TEXT("SeekCore");
            if (FVector::Dist(Bot->GetActorLocation(), Core->GetActorLocation()) <= InManager->PickupRange)
            {
                return InManager->BeginPickup(Bot);
            }
            if (ABLATacticalPoint* Approach = ResolvePoint(EBLA_TacticalPointType::AttackPoint))
            {
                const float DistToApproach = FVector::Dist2D(Bot->GetActorLocation(), Approach->GetActorLocation());
                const float DistToCore = FVector::Dist2D(Bot->GetActorLocation(), Core->GetActorLocation());
                const bool bLaneMatches = PreferredLane < 0 || LaneIndexFromY(Approach->GetActorLocation().Y) == PreferredLane;
                if (bLaneMatches && DistToApproach > ApproachArrivalDistance
                    && DistToApproach + ApproachAdvantageDistance < DistToCore)
                {
                    DirectiveTarget = Approach;
                    MoveToDirective(Approach->GetActorLocation());
                    ClaimPoint();
                    return true;
                }
            }
            MoveToDirective(Core->GetActorLocation());
            return true;
        }
        DirectiveTarget = ResolvePoint(EBLA_TacticalPointType::PlantPoint);
        MoveToDirective(DirectiveTarget ? DirectiveTarget->GetActorLocation()
            : (Zone ? Zone->GetActorLocation() : Bot->GetActorLocation()));
        ClaimPoint();
        CurrentObjectiveTask = TEXT("DefendPlant");
        return true;
    }

    if (bPlanted && Core)
    {
        CurrentObjectiveTask = TEXT("Defuse");
        if (ObjectiveState == EBLA_ObjectiveState::Defusing)
        {
            // Hold position while the defuse timer runs; any move request would cancel
            // the interaction (movement cancel) and restart the timer.
            return true;
        }
        if (Zone && Zone->ContainsActor(Bot)
            && ObjectiveState != EBLA_ObjectiveState::Defused && ObjectiveState != EBLA_ObjectiveState::Completed
            && InManager->BeginDefuse(Bot))
        {
            StopMovement();
            return true;
        }
        MoveToDirective(Core->GetActorLocation());
        return true;
    }
    if (Core && Core->Carrier && Core->Carrier != Bot)
    {
        MoveToDirective(Core->Carrier->GetActorLocation());
        CurrentObjectiveTask = TEXT("InterceptCarrier");
        return true;
    }
    if (Core && Core->State == EBLA_ObjectiveState::Dropped)
    {
        MoveToDirective(Core->GetActorLocation());
        CurrentObjectiveTask = TEXT("Investigate");
        return true;
    }
    DirectiveTarget = ResolvePoint(EBLA_TacticalPointType::DefusePoint);
    MoveToDirective(DirectiveTarget ? DirectiveTarget->GetActorLocation()
        : (Zone ? Zone->GetActorLocation() : Bot->GetActorLocation()));
    ClaimPoint();
    CurrentObjectiveTask = TEXT("GuardObjective");
    return true;
}

void ABLAAIController::HandleTeamOrderChanged(EBLA_RoundPhase Phase)
{
    if (Phase == EBLA_RoundPhase::Loading)
    {
        bHasActiveTeamOrder = false;
        CurrentTeamOrder = EBLA_TeamOrder::FollowPlayer;
        DirectiveLocation = FVector::ZeroVector;
        FollowTarget = nullptr;
        if (RoleTacticalManager && RoleTeamManager)
        {
            ResolveRoleDirective(RoleTacticalManager, RoleTeamManager, RolePlayerActor);
        }
        return;
    }
    ResolveTeamOrder(TeamOrderManager, Phase);
}
