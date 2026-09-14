#include "BLAAIController.h"

#include "BehaviorTree/BehaviorTree.h"
#include "BLABotPerception.h"
#include "BLACharacterBase.h"
#include "BLADataCore.h"
#include "BLAHealthComponent.h"
#include "BLAObjectiveManager.h"
#include "BLAObjectiveZone.h"
#include "BLATacticalManager.h"
#include "BLATacticalPoint.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "BLAWeaponComponent.h"
#include "Navigation/PathFollowingComponent.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Damage.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Perception/AISenseConfig_Sight.h"

namespace
{
    constexpr float DirectiveMoveRefreshDistance = 150.0f;
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
    if (!Observer || !Candidate)
    {
        return false;
    }
    if (StimulusType == EBLA_StimulusType::Sight && !LineOfSightTo(Candidate))
    {
        return false;
    }
    return BotPerception->ReportStimulus(Observer, Candidate, StimulusType, Candidate->GetActorLocation());
}

bool ABLAAIController::AimAndFireAtTarget()
{
    ABLACharacterBase* Shooter = Cast<ABLACharacterBase>(GetPawn());
    ABLACharacterBase* Target = Cast<ABLACharacterBase>(BotPerception->TargetActor);
    if (!Shooter || !Target || !Shooter->GetIsAlive() || !Target->GetIsAlive() || Shooter->Team == Target->Team
        || !Shooter->WeaponComponent || !Shooter->WeaponComponent->CanFire() || !LineOfSightTo(Target))
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
    return Shooter->WeaponComponent->FireWeapon(Start, Direction);
}

void ABLAAIController::ApplyDifficulty(UBLABotDifficultyDataAsset* InDifficulty)
{
    DifficultyAsset = InDifficulty;
    if (DifficultyAsset)
    {
        AppliedAimErrorDegrees = FMath::Max(0.1f, DifficultyAsset->Difficulty.AimErrorDegrees);
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
    ABLATacticalPoint* Recovery = Manager->FindNearestReachablePoint(Bot, Bot->Team);
    bIsStuck = false;
    return Recovery && MoveToTacticalPoint(Recovery);
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
    if (BotRole == EBLA_BotRole::Assault)
    {
        DirectiveTarget = Manager->FindBestPoint(Bot, EBLA_TacticalPointType::AttackPoint, Bot->Team, BotRole);
    }
    else if (BotRole == EBLA_BotRole::Defender)
    {
        DirectiveTarget = Manager->FindBestPoint(Bot, EBLA_TacticalPointType::GuardPoint, Bot->Team, BotRole);
    }
    else
    {
        ABLACharacterBase* PreferredPlayer = Cast<ABLACharacterBase>(PlayerActor);
        if (PreferredPlayer && PreferredPlayer->Team == Bot->Team && PreferredPlayer->GetIsAlive())
        {
            FollowTarget = PreferredPlayer;
        }
        else
        {
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
            FollowTarget = BestFriendly;
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
    CurrentObjectiveTask = NAME_None;
    bHasObjectiveDirective = false;
    bHasObjectiveMoveTarget = false;
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
    DirectiveTarget = nullptr;
    FollowTarget = nullptr;
    bHasObjectiveDirective = false;
    CurrentObjectiveTask = NAME_None;

    ABLADataCore* Core = InManager->DataCore;
    ABLAObjectiveZone* Zone = InManager->ObjectiveZone;
    const EBLA_ObjectiveState ObjectiveState = InManager->ObjectiveState;
    const bool bPlanted = InManager->IsPlanted();

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
    const auto ResolvePoint = [this, InTacticalManager, Bot](EBLA_TacticalPointType Type)
    {
        return InTacticalManager ? InTacticalManager->FindBestPoint(Bot, Type, Bot->Team, BotRole) : nullptr;
    };

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
            MoveToDirective(Core->GetActorLocation());
            return true;
        }
        DirectiveTarget = ResolvePoint(EBLA_TacticalPointType::PlantPoint);
        MoveToDirective(DirectiveTarget ? DirectiveTarget->GetActorLocation()
            : (Zone ? Zone->GetActorLocation() : Bot->GetActorLocation()));
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
