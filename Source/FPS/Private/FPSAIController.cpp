#include "FPSAIController.h"

#include "BehaviorTree/BehaviorTree.h"
#include "FPSBotPerception.h"
#include "FPSCharacterBase.h"
#include "FPSHealthComponent.h"
#include "FPSTacticalManager.h"
#include "FPSTacticalPoint.h"
#include "FPSTeamManager.h"
#include "FPSTeamOrderManager.h"
#include "FPSWeaponComponent.h"
#include "Navigation/PathFollowingComponent.h"
#include "Perception/AIPerceptionComponent.h"
#include "Perception/AISenseConfig_Damage.h"
#include "Perception/AISenseConfig_Hearing.h"
#include "Perception/AISenseConfig_Sight.h"

AFPSAIController::AFPSAIController()
{
    PrimaryActorTick.bCanEverTick = true;
    AIPerception = CreateDefaultSubobject<UAIPerceptionComponent>(TEXT("AIPerception"));
    BotPerception = CreateDefaultSubobject<UFPSBotPerception>(TEXT("BotPerception"));

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

void AFPSAIController::OnPossess(APawn* InPawn)
{
    Super::OnPossess(InPawn);
    LastStuckCheckLocation = InPawn ? InPawn->GetActorLocation() : FVector::ZeroVector;
    if (EliminationTree)
    {
        RunBehaviorTree(EliminationTree);
    }
}

void AFPSAIController::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    APawn* ControlledPawn = GetPawn();
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

bool AFPSAIController::UpdateTarget(AActor* Candidate, EFPS_StimulusType StimulusType)
{
    AFPSCharacterBase* Observer = Cast<AFPSCharacterBase>(GetPawn());
    if (!Observer || !Candidate)
    {
        return false;
    }
    if (StimulusType == EFPS_StimulusType::Sight && !LineOfSightTo(Candidate))
    {
        return false;
    }
    return BotPerception->ReportStimulus(Observer, Candidate, StimulusType, Candidate->GetActorLocation());
}

bool AFPSAIController::AimAndFireAtTarget()
{
    AFPSCharacterBase* Shooter = Cast<AFPSCharacterBase>(GetPawn());
    AFPSCharacterBase* Target = Cast<AFPSCharacterBase>(BotPerception->TargetActor);
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
    const FVector Direction = ((TargetLocation - Start).Rotation() + FRotator(0.0f, AppliedAimErrorDegrees, 0.0f)).Vector();
    return Shooter->WeaponComponent->FireWeapon(Start, Direction);
}

void AFPSAIController::ApplyDifficulty(UFPSBotDifficultyDataAsset* InDifficulty)
{
    DifficultyAsset = InDifficulty;
    if (DifficultyAsset)
    {
        AppliedAimErrorDegrees = FMath::Max(0.1f, DifficultyAsset->Difficulty.AimErrorDegrees);
    }
}

bool AFPSAIController::MoveToTacticalPoint(AFPSTacticalPoint* Point)
{
    return Point && MoveToLocation(Point->GetActorLocation(), 50.0f, true) != EPathFollowingRequestResult::Failed;
}

bool AFPSAIController::RecoverFromStuck(AFPSTacticalManager* Manager)
{
    AFPSCharacterBase* Bot = Cast<AFPSCharacterBase>(GetPawn());
    if (!Bot || !Manager)
    {
        return false;
    }
    AFPSTacticalPoint* Recovery = Manager->FindNearestReachablePoint(Bot, Bot->Team);
    bIsStuck = false;
    return Recovery && MoveToTacticalPoint(Recovery);
}

bool AFPSAIController::ResolveRoleDirective(AFPSTacticalManager* Manager, AFPSTeamManager* TeamManager, AActor* PlayerActor)
{
    AFPSCharacterBase* Bot = Cast<AFPSCharacterBase>(GetPawn());
    if (!Bot || !Manager || !TeamManager)
    {
        return false;
    }

    RoleTacticalManager = Manager;
    RoleTeamManager = TeamManager;
    RolePlayerActor = PlayerActor;

    DirectiveTarget = nullptr;
    FollowTarget = nullptr;
    if (BotRole == EFPS_BotRole::Assault)
    {
        DirectiveTarget = Manager->FindBestPoint(Bot, EFPS_TacticalPointType::AttackPoint, Bot->Team, BotRole);
    }
    else if (BotRole == EFPS_BotRole::Defender)
    {
        DirectiveTarget = Manager->FindBestPoint(Bot, EFPS_TacticalPointType::GuardPoint, Bot->Team, BotRole);
    }
    else
    {
        AFPSCharacterBase* PreferredPlayer = Cast<AFPSCharacterBase>(PlayerActor);
        if (PreferredPlayer && PreferredPlayer->Team == Bot->Team && PreferredPlayer->GetIsAlive())
        {
            FollowTarget = PreferredPlayer;
        }
        else
        {
            AFPSCharacterBase* BestFriendly = nullptr;
            int32 BestPriority = -1;
            for (AFPSCharacterBase* Friendly : TeamManager->GetTeamMembers(Bot->Team))
            {
                if (!Friendly || Friendly == Bot || !Friendly->GetIsAlive())
                {
                    continue;
                }
                const AFPSAIController* FriendlyAI = Cast<AFPSAIController>(Friendly->GetController());
                const int32 Priority = !FriendlyAI ? 4
                    : FriendlyAI->BotRole == EFPS_BotRole::Assault ? 3
                    : FriendlyAI->BotRole == EFPS_BotRole::Support ? 2 : 1;
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

bool AFPSAIController::ResolveTeamOrder(AFPSTeamOrderManager* OrderManager, EFPS_RoundPhase Phase)
{
    AFPSCharacterBase* Bot = Cast<AFPSCharacterBase>(GetPawn());
    const AFPSCharacterBase* IssuerCombatant = OrderManager ? Cast<AFPSCharacterBase>(OrderManager->Issuer) : nullptr;
    if (!Bot || !IssuerCombatant || Bot->Team != IssuerCombatant->Team || !OrderManager->IsOrderActive(Phase))
    {
        return false;
    }

    CurrentTeamOrder = OrderManager->CurrentOrder;
    DirectiveLocation = OrderManager->TargetLocation;
    DirectiveTarget = nullptr;
    FollowTarget = CurrentTeamOrder == EFPS_TeamOrder::FollowPlayer ? OrderManager->Issuer : nullptr;
    bHasActiveTeamOrder = true;
    return true;
}

void AFPSAIController::ConfigureTeamOrders(AFPSTeamOrderManager* OrderManager)
{
    if (TeamOrderManager)
    {
        TeamOrderManager->OnOrderChanged.RemoveAll(this);
    }
    TeamOrderManager = OrderManager;
    if (TeamOrderManager)
    {
        TeamOrderManager->OnOrderChanged.AddUObject(this, &AFPSAIController::HandleTeamOrderChanged);
    }
}

void AFPSAIController::HandleTeamOrderChanged(EFPS_RoundPhase Phase)
{
    if (Phase == EFPS_RoundPhase::Loading)
    {
        bHasActiveTeamOrder = false;
        CurrentTeamOrder = EFPS_TeamOrder::FollowPlayer;
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
