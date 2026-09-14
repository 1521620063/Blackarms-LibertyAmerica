#include "FPSObjectiveManager.h"

#include "FPSCharacterBase.h"
#include "FPSDataCore.h"
#include "FPSGameState.h"
#include "FPSHealthComponent.h"
#include "FPSObjectiveZone.h"
#include "FPSRoundManager.h"
#include "FPSTeamManager.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    constexpr float DefaultPlantSeconds = 5.0f;
    constexpr float DefaultDefuseSeconds = 5.0f;
    constexpr float DefaultUploadSeconds = 30.0f;
    constexpr float PlantedCoreHeightOffset = 40.0f;
    constexpr float HomeLocationTolerance = 150.0f;
}

AFPSObjectiveManager::AFPSObjectiveManager()
{
    PrimaryActorTick.bCanEverTick = true;
}

void AFPSObjectiveManager::BeginPlay()
{
    Super::BeginPlay();
    if (!FPSGameState)
    {
        FPSGameState = Cast<AFPSGameState>(UGameplayStatics::GetGameState(this));
    }
    if (!RoundManager)
    {
        RoundManager = Cast<AFPSRoundManager>(UGameplayStatics::GetActorOfClass(this, AFPSRoundManager::StaticClass()));
    }
    if (!DataCore)
    {
        DataCore = Cast<AFPSDataCore>(UGameplayStatics::GetActorOfClass(this, AFPSDataCore::StaticClass()));
    }
    if (!ObjectiveZone)
    {
        ObjectiveZone = Cast<AFPSObjectiveZone>(UGameplayStatics::GetActorOfClass(this, AFPSObjectiveZone::StaticClass()));
    }
    if (!TeamManager)
    {
        TeamManager = Cast<AFPSTeamManager>(UGameplayStatics::GetActorOfClass(this, AFPSTeamManager::StaticClass()));
    }
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
        TeamManager->OnCombatantDeath.AddUObject(this, &AFPSObjectiveManager::HandleCombatantDeath);
    }
    LastObservedPhase = FPSGameState ? FPSGameState->RoundPhase : EFPS_RoundPhase::Loading;
    SetObjectiveState(DataCore ? DataCore->State : EFPS_ObjectiveState::None);
}

void AFPSObjectiveManager::Configure(AFPSGameState* InGameState, AFPSRoundManager* InRoundManager,
    AFPSDataCore* InDataCore, AFPSObjectiveZone* InZone, AFPSTeamManager* InTeamManager)
{
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
    }
    ClearActiveInteractor();
    FPSGameState = InGameState;
    RoundManager = InRoundManager;
    DataCore = InDataCore;
    ObjectiveZone = InZone;
    TeamManager = InTeamManager;
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.AddUObject(this, &AFPSObjectiveManager::HandleCombatantDeath);
    }
    LastObservedPhase = FPSGameState ? FPSGameState->RoundPhase : EFPS_RoundPhase::Loading;
    SetObjectiveState(DataCore ? DataCore->State : EFPS_ObjectiveState::None);
}

void AFPSObjectiveManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    ObserveRoundPhase();
    RecoverCoreIfNeeded();

    const float Step = FMath::Max(0.0f, DeltaSeconds);
    if (AFPSCharacterBase* Interactor = Cast<AFPSCharacterBase>(ActiveInteractor))
    {
        if (!IsInteractorUsable(Interactor))
        {
            CancelInteraction(Interactor, TEXT("Death"));
            return;
        }
        if (ObjectiveState == EFPS_ObjectiveState::Planting || ObjectiveState == EFPS_ObjectiveState::Defusing)
        {
            if (ObjectiveZone && !ObjectiveZone->ContainsActor(Interactor))
            {
                CancelInteraction(Interactor, TEXT("LeftZone"));
                return;
            }
            if (FVector::DistSquared2D(InteractionStartLocation, Interactor->GetActorLocation())
                > FMath::Square(MovementCancelTolerance))
            {
                CancelInteraction(Interactor, TEXT("Movement"));
                return;
            }
            InteractionRemaining = FMath::Max(0.0f, InteractionRemaining - Step);
            if (InteractionRemaining > 0.0f)
            {
                return;
            }
            if (ObjectiveState == EFPS_ObjectiveState::Planting)
            {
                CompletePlant();
            }
            else
            {
                CompleteDefuse();
            }
            return;
        }
    }

    if (ObjectiveState == EFPS_ObjectiveState::Planted)
    {
        SetObjectiveState(EFPS_ObjectiveState::Uploading);
        return;
    }
    if (ObjectiveState == EFPS_ObjectiveState::Uploading)
    {
        UploadRemaining = FMath::Max(0.0f, UploadRemaining - Step);
        if (UploadRemaining <= 0.0f)
        {
            CompleteUpload();
        }
    }
}

bool AFPSObjectiveManager::BeginPickup(AFPSCharacterBase* Interactor)
{
    if (!DataCore || !IsInteractorUsable(Interactor) || Interactor->Team != EFPS_Team::Attackers)
    {
        return false;
    }
    if (!DataCore->CanBePickedUp())
    {
        return false;
    }
    if (FVector::DistSquared(Interactor->GetActorLocation(), DataCore->GetActorLocation())
        > FMath::Square(PickupRange))
    {
        return false;
    }
    if (!DataCore->GiveTo(Interactor))
    {
        return false;
    }
    ClearActiveInteractor();
    SetObjectiveState(EFPS_ObjectiveState::Carried);
    return true;
}

bool AFPSObjectiveManager::BeginPlant(AFPSCharacterBase* Interactor)
{
    if (!DataCore || !ObjectiveZone || !IsInteractorUsable(Interactor)
        || Interactor->Team != EFPS_Team::Attackers)
    {
        return false;
    }
    if (ObjectiveState != EFPS_ObjectiveState::Carried || !DataCore->IsCarriedBy(Interactor))
    {
        return false;
    }
    if (!ObjectiveZone->ContainsActor(Interactor))
    {
        return false;
    }
    StateBeforeInteraction = EFPS_ObjectiveState::Carried;
    InteractionRemaining = ResolveRules().PlantSeconds;
    SetActiveInteractor(Interactor);
    SetObjectiveState(EFPS_ObjectiveState::Planting);
    return true;
}

bool AFPSObjectiveManager::BeginDefuse(AFPSCharacterBase* Interactor)
{
    if (!DataCore || !ObjectiveZone || !IsInteractorUsable(Interactor)
        || Interactor->Team != EFPS_Team::Defenders)
    {
        return false;
    }
    if (ObjectiveState != EFPS_ObjectiveState::Planted && ObjectiveState != EFPS_ObjectiveState::Uploading)
    {
        return false;
    }
    if (!ObjectiveZone->ContainsActor(Interactor) || !ObjectiveZone->ContainsLocation(DataCore->GetActorLocation()))
    {
        return false;
    }
    StateBeforeInteraction = ObjectiveState;
    InteractionRemaining = ResolveRules().DefuseSeconds;
    SetActiveInteractor(Interactor);
    SetObjectiveState(EFPS_ObjectiveState::Defusing);
    return true;
}

void AFPSObjectiveManager::CancelInteraction(AActor* Interactor, FName Reason)
{
    if (!ActiveInteractor || (Interactor && Interactor != ActiveInteractor))
    {
        return;
    }
    if (ObjectiveState != EFPS_ObjectiveState::Planting && ObjectiveState != EFPS_ObjectiveState::Defusing)
    {
        ClearActiveInteractor();
        return;
    }
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    LastCancelReason = Reason;
    SetObjectiveState(StateBeforeInteraction);
}

void AFPSObjectiveManager::HandleCarrierDeath(AFPSCharacterBase* Carrier)
{
    if (!DataCore || !DataCore->IsCarriedBy(Carrier))
    {
        return;
    }
    if (ObjectiveState == EFPS_ObjectiveState::Planting)
    {
        CancelInteraction(Carrier, TEXT("Death"));
    }
    DataCore->RemoveFromCarrier();
    SetObjectiveState(EFPS_ObjectiveState::Dropped);
}

void AFPSObjectiveManager::ResetObjective()
{
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    UploadRemaining = 0.0f;
    LastCancelReason = NAME_None;
    if (DataCore)
    {
        DataCore->ResetToHome();
        SetObjectiveState(DataCore->State);
    }
    else
    {
        SetObjectiveState(EFPS_ObjectiveState::None);
    }
}

bool AFPSObjectiveManager::IsObjectiveInValidArea() const
{
    if (!DataCore)
    {
        return false;
    }
    if (DataCore->State == EFPS_ObjectiveState::Carried)
    {
        return true;
    }
    const FVector Location = DataCore->GetActorLocation();
    if (ObjectiveZone && ObjectiveZone->ContainsLocation(Location))
    {
        return true;
    }
    return FVector::DistSquared(Location, DataCore->HomeLocation) <= FMath::Square(HomeLocationTolerance);
}

bool AFPSObjectiveManager::IsPlanted() const
{
    return ObjectiveState == EFPS_ObjectiveState::Planted
        || ObjectiveState == EFPS_ObjectiveState::Uploading
        || ObjectiveState == EFPS_ObjectiveState::Defusing
        || ObjectiveState == EFPS_ObjectiveState::Defused
        || ObjectiveState == EFPS_ObjectiveState::Completed;
}

bool AFPSObjectiveManager::IsInteractionActive() const
{
    return ActiveInteractor != nullptr;
}

void AFPSObjectiveManager::ClearCoreRecoveryFlag()
{
    bCoreRecovered = false;
    LastRecoveryReason = NAME_None;
}

void AFPSObjectiveManager::SetObjectiveState(EFPS_ObjectiveState NewState)
{
    ObjectiveState = NewState;
    if (FPSGameState)
    {
        FPSGameState->CurrentObjectiveState = NewState;
    }
}

void AFPSObjectiveManager::SetActiveInteractor(AFPSCharacterBase* Interactor)
{
    ClearActiveInteractor();
    if (!Interactor)
    {
        return;
    }
    ActiveInteractor = Interactor;
    InteractionStartLocation = Interactor->GetActorLocation();
    if (Interactor->HealthComponent)
    {
        Interactor->HealthComponent->OnHealthChanged.AddDynamic(this, &AFPSObjectiveManager::HandleInteractorHealthChanged);
        Interactor->HealthComponent->OnDeath.AddDynamic(this, &AFPSObjectiveManager::HandleInteractorDeath);
    }
}

void AFPSObjectiveManager::ClearActiveInteractor()
{
    if (AFPSCharacterBase* Interactor = Cast<AFPSCharacterBase>(ActiveInteractor))
    {
        if (Interactor->HealthComponent)
        {
            Interactor->HealthComponent->OnHealthChanged.RemoveDynamic(this, &AFPSObjectiveManager::HandleInteractorHealthChanged);
            Interactor->HealthComponent->OnDeath.RemoveDynamic(this, &AFPSObjectiveManager::HandleInteractorDeath);
        }
    }
    ActiveInteractor = nullptr;
}

void AFPSObjectiveManager::CompletePlant()
{
    if (DataCore)
    {
        if (DataCore->State == EFPS_ObjectiveState::Carried)
        {
            DataCore->RemoveFromCarrier();
        }
        if (ObjectiveZone)
        {
            DataCore->SetActorLocation(ObjectiveZone->GetActorLocation() + FVector(0.0f, 0.0f, PlantedCoreHeightOffset));
        }
        DataCore->SetObjectiveState(EFPS_ObjectiveState::Planted);
    }
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    UploadRemaining = ResolveRules().UploadSeconds;
    SetObjectiveState(EFPS_ObjectiveState::Planted);
}

void AFPSObjectiveManager::CompleteDefuse()
{
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    if (DataCore)
    {
        DataCore->SetObjectiveState(EFPS_ObjectiveState::Defused);
    }
    SetObjectiveState(EFPS_ObjectiveState::Defused);
    if (RoundManager)
    {
        RoundManager->EndRound(EFPS_Team::Defenders, TEXT("ObjectiveDefused"));
    }
}

void AFPSObjectiveManager::CompleteUpload()
{
    ClearActiveInteractor();
    UploadRemaining = 0.0f;
    if (DataCore)
    {
        DataCore->SetObjectiveState(EFPS_ObjectiveState::Completed);
    }
    SetObjectiveState(EFPS_ObjectiveState::Completed);
    if (RoundManager)
    {
        RoundManager->EndRound(EFPS_Team::Attackers, TEXT("ObjectiveUploaded"));
    }
}

void AFPSObjectiveManager::ObserveRoundPhase()
{
    if (!FPSGameState || FPSGameState->RoundPhase == LastObservedPhase)
    {
        return;
    }
    LastObservedPhase = FPSGameState->RoundPhase;
    if (LastObservedPhase == EFPS_RoundPhase::Preparation)
    {
        ResetObjective();
        return;
    }
    if (LastObservedPhase == EFPS_RoundPhase::RoundResult
        || LastObservedPhase == EFPS_RoundPhase::MatchResult
        || LastObservedPhase == EFPS_RoundPhase::Loading)
    {
        CancelInteraction(nullptr, TEXT("RoundTransition"));
    }
}

void AFPSObjectiveManager::RecoverCoreIfNeeded()
{
    if (!DataCore || DataCore->State == EFPS_ObjectiveState::Carried || IsObjectiveInValidArea())
    {
        return;
    }
    DataCore->ResetToHome();
    SetObjectiveState(EFPS_ObjectiveState::Available);
    bCoreRecovered = true;
    LastRecoveryReason = TEXT("OutsideValidArea");
    UE_LOG(LogTemp, Warning, TEXT("FPS_OBJECTIVE_CORE_RELOCATED location=%s"), *DataCore->GetActorLocation().ToCompactString());
}

bool AFPSObjectiveManager::IsInteractorUsable(const AFPSCharacterBase* Interactor) const
{
    return Interactor != nullptr && Interactor->GetIsAlive();
}

FFPSMatchRules AFPSObjectiveManager::ResolveRules() const
{
    FFPSMatchRules Rules;
    if (RoundManager)
    {
        Rules = RoundManager->GetActiveRules();
    }
    if (Rules.PlantSeconds <= 0.0f)
    {
        Rules.PlantSeconds = DefaultPlantSeconds;
    }
    if (Rules.DefuseSeconds <= 0.0f)
    {
        Rules.DefuseSeconds = DefaultDefuseSeconds;
    }
    if (Rules.UploadSeconds <= 0.0f)
    {
        Rules.UploadSeconds = DefaultUploadSeconds;
    }
    return Rules;
}

void AFPSObjectiveManager::HandleInteractorHealthChanged(float CurrentHealth, float Delta)
{
    if (Delta < 0.0f)
    {
        CancelInteraction(ActiveInteractor, TEXT("Damage"));
    }
}

void AFPSObjectiveManager::HandleInteractorDeath(AActor* InstigatorActor)
{
    CancelInteraction(ActiveInteractor, TEXT("Death"));
}

void AFPSObjectiveManager::HandleCombatantDeath(AFPSCharacterBase* DeadCombatant, AActor* InstigatorActor)
{
    if (ActiveInteractor == DeadCombatant)
    {
        CancelInteraction(DeadCombatant, TEXT("Death"));
    }
    HandleCarrierDeath(DeadCombatant);
}
