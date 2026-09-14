#include "BLAObjectiveManager.h"

#include "BLACharacterBase.h"
#include "BLADataCore.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLAObjectiveZone.h"
#include "BLARoundManager.h"
#include "BLATeamManager.h"
#include "Kismet/GameplayStatics.h"

namespace
{
    constexpr float DefaultPlantSeconds = 5.0f;
    constexpr float DefaultDefuseSeconds = 5.0f;
    constexpr float DefaultUploadSeconds = 30.0f;
    constexpr float PlantedCoreHeightOffset = 40.0f;
    constexpr float HomeLocationTolerance = 150.0f;
}

ABLAObjectiveManager::ABLAObjectiveManager()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLAObjectiveManager::BeginPlay()
{
    Super::BeginPlay();
    if (!BLAGameState)
    {
        BLAGameState = Cast<ABLAGameState>(UGameplayStatics::GetGameState(this));
    }
    if (!RoundManager)
    {
        RoundManager = Cast<ABLARoundManager>(UGameplayStatics::GetActorOfClass(this, ABLARoundManager::StaticClass()));
    }
    if (!DataCore)
    {
        DataCore = Cast<ABLADataCore>(UGameplayStatics::GetActorOfClass(this, ABLADataCore::StaticClass()));
    }
    if (!ObjectiveZone)
    {
        ObjectiveZone = Cast<ABLAObjectiveZone>(UGameplayStatics::GetActorOfClass(this, ABLAObjectiveZone::StaticClass()));
    }
    if (!TeamManager)
    {
        TeamManager = Cast<ABLATeamManager>(UGameplayStatics::GetActorOfClass(this, ABLATeamManager::StaticClass()));
    }
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
        TeamManager->OnCombatantDeath.AddUObject(this, &ABLAObjectiveManager::HandleCombatantDeath);
    }
    LastObservedPhase = BLAGameState ? BLAGameState->RoundPhase : EBLA_RoundPhase::Loading;
    SetObjectiveState(DataCore ? DataCore->State : EBLA_ObjectiveState::None);
}

void ABLAObjectiveManager::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
    }
    ClearActiveInteractor();
    Super::EndPlay(EndPlayReason);
}

void ABLAObjectiveManager::Configure(ABLAGameState* InGameState, ABLARoundManager* InRoundManager,
    ABLADataCore* InDataCore, ABLAObjectiveZone* InZone, ABLATeamManager* InTeamManager)
{
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.RemoveAll(this);
    }
    ClearActiveInteractor();
    BLAGameState = InGameState;
    RoundManager = InRoundManager;
    DataCore = InDataCore;
    ObjectiveZone = InZone;
    TeamManager = InTeamManager;
    if (TeamManager)
    {
        TeamManager->OnCombatantDeath.AddUObject(this, &ABLAObjectiveManager::HandleCombatantDeath);
    }
    LastObservedPhase = BLAGameState ? BLAGameState->RoundPhase : EBLA_RoundPhase::Loading;
    SetObjectiveState(DataCore ? DataCore->State : EBLA_ObjectiveState::None);
}

void ABLAObjectiveManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    ObserveRoundPhase();
    RecoverCoreIfNeeded();

    const float Step = FMath::Max(0.0f, DeltaSeconds);
    if (ABLACharacterBase* Interactor = Cast<ABLACharacterBase>(ActiveInteractor))
    {
        if (!IsInteractorUsable(Interactor))
        {
            CancelInteraction(Interactor, TEXT("Death"));
            return;
        }
        if (ObjectiveState == EBLA_ObjectiveState::Planting || ObjectiveState == EBLA_ObjectiveState::Defusing)
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
            if (ObjectiveState == EBLA_ObjectiveState::Planting)
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

    if (ObjectiveState == EBLA_ObjectiveState::Planted)
    {
        SetObjectiveState(EBLA_ObjectiveState::Uploading);
        return;
    }
    if (ObjectiveState == EBLA_ObjectiveState::Uploading)
    {
        UploadRemaining = FMath::Max(0.0f, UploadRemaining - Step);
        if (UploadRemaining <= 0.0f)
        {
            CompleteUpload();
        }
    }
}

bool ABLAObjectiveManager::BeginPickup(ABLACharacterBase* Interactor)
{
    if (!DataCore || !IsInteractorUsable(Interactor) || Interactor->Team != EBLA_Team::Attackers)
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
    SetObjectiveState(EBLA_ObjectiveState::Carried);
    return true;
}

bool ABLAObjectiveManager::BeginPlant(ABLACharacterBase* Interactor)
{
    if (!DataCore || !ObjectiveZone || !IsInteractorUsable(Interactor)
        || Interactor->Team != EBLA_Team::Attackers)
    {
        return false;
    }
    if (ObjectiveState != EBLA_ObjectiveState::Carried || !DataCore->IsCarriedBy(Interactor))
    {
        return false;
    }
    if (!ObjectiveZone->ContainsActor(Interactor))
    {
        return false;
    }
    StateBeforeInteraction = EBLA_ObjectiveState::Carried;
    InteractionRemaining = ResolveRules().PlantSeconds;
    SetActiveInteractor(Interactor);
    SetObjectiveState(EBLA_ObjectiveState::Planting);
    return true;
}

bool ABLAObjectiveManager::BeginDefuse(ABLACharacterBase* Interactor)
{
    if (!DataCore || !ObjectiveZone || !IsInteractorUsable(Interactor)
        || Interactor->Team != EBLA_Team::Defenders)
    {
        return false;
    }
    if (ObjectiveState != EBLA_ObjectiveState::Planted && ObjectiveState != EBLA_ObjectiveState::Uploading)
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
    SetObjectiveState(EBLA_ObjectiveState::Defusing);
    return true;
}

void ABLAObjectiveManager::CancelInteraction(AActor* Interactor, FName Reason)
{
    if (!ActiveInteractor || (Interactor && Interactor != ActiveInteractor))
    {
        return;
    }
    if (ObjectiveState != EBLA_ObjectiveState::Planting && ObjectiveState != EBLA_ObjectiveState::Defusing)
    {
        ClearActiveInteractor();
        return;
    }
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    LastCancelReason = Reason;
    SetObjectiveState(StateBeforeInteraction);
}

void ABLAObjectiveManager::HandleCarrierDeath(ABLACharacterBase* Carrier)
{
    if (!DataCore || !DataCore->IsCarriedBy(Carrier))
    {
        return;
    }
    if (ObjectiveState == EBLA_ObjectiveState::Planting)
    {
        CancelInteraction(Carrier, TEXT("Death"));
    }
    DataCore->RemoveFromCarrier();
    SetObjectiveState(EBLA_ObjectiveState::Dropped);
}

void ABLAObjectiveManager::ResetObjective()
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
        SetObjectiveState(EBLA_ObjectiveState::None);
    }
}

bool ABLAObjectiveManager::IsObjectiveInValidArea() const
{
    if (!DataCore)
    {
        return false;
    }
    if (DataCore->State == EBLA_ObjectiveState::Carried)
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

bool ABLAObjectiveManager::IsPlanted() const
{
    return ObjectiveState == EBLA_ObjectiveState::Planted
        || ObjectiveState == EBLA_ObjectiveState::Uploading
        || ObjectiveState == EBLA_ObjectiveState::Defusing
        || ObjectiveState == EBLA_ObjectiveState::Defused
        || ObjectiveState == EBLA_ObjectiveState::Completed;
}

bool ABLAObjectiveManager::IsInteractionActive() const
{
    return ActiveInteractor != nullptr;
}

void ABLAObjectiveManager::ClearCoreRecoveryFlag()
{
    bCoreRecovered = false;
    LastRecoveryReason = NAME_None;
}

void ABLAObjectiveManager::SetObjectiveState(EBLA_ObjectiveState NewState)
{
    ObjectiveState = NewState;
    if (BLAGameState)
    {
        BLAGameState->CurrentObjectiveState = NewState;
    }
}

void ABLAObjectiveManager::SetActiveInteractor(ABLACharacterBase* Interactor)
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
        Interactor->HealthComponent->OnHealthChanged.AddDynamic(this, &ABLAObjectiveManager::HandleInteractorHealthChanged);
        Interactor->HealthComponent->OnDeath.AddDynamic(this, &ABLAObjectiveManager::HandleInteractorDeath);
    }
}

void ABLAObjectiveManager::ClearActiveInteractor()
{
    if (ABLACharacterBase* Interactor = Cast<ABLACharacterBase>(ActiveInteractor))
    {
        if (Interactor->HealthComponent)
        {
            Interactor->HealthComponent->OnHealthChanged.RemoveDynamic(this, &ABLAObjectiveManager::HandleInteractorHealthChanged);
            Interactor->HealthComponent->OnDeath.RemoveDynamic(this, &ABLAObjectiveManager::HandleInteractorDeath);
        }
    }
    ActiveInteractor = nullptr;
}

void ABLAObjectiveManager::CompletePlant()
{
    if (DataCore)
    {
        if (DataCore->State == EBLA_ObjectiveState::Carried)
        {
            DataCore->RemoveFromCarrier();
        }
        if (ObjectiveZone)
        {
            DataCore->SetActorLocation(ObjectiveZone->GetActorLocation() + FVector(0.0f, 0.0f, PlantedCoreHeightOffset));
        }
        DataCore->SetObjectiveState(EBLA_ObjectiveState::Planted);
    }
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    UploadRemaining = ResolveRules().UploadSeconds;
    SetObjectiveState(EBLA_ObjectiveState::Planted);
}

void ABLAObjectiveManager::CompleteDefuse()
{
    ClearActiveInteractor();
    InteractionRemaining = 0.0f;
    if (DataCore)
    {
        DataCore->SetObjectiveState(EBLA_ObjectiveState::Defused);
    }
    SetObjectiveState(EBLA_ObjectiveState::Defused);
    if (RoundManager)
    {
        RoundManager->EndRound(EBLA_Team::Defenders, TEXT("ObjectiveDefused"));
    }
}

void ABLAObjectiveManager::CompleteUpload()
{
    ClearActiveInteractor();
    UploadRemaining = 0.0f;
    if (DataCore)
    {
        DataCore->SetObjectiveState(EBLA_ObjectiveState::Completed);
    }
    SetObjectiveState(EBLA_ObjectiveState::Completed);
    if (RoundManager)
    {
        RoundManager->EndRound(EBLA_Team::Attackers, TEXT("ObjectiveUploaded"));
    }
}

void ABLAObjectiveManager::ObserveRoundPhase()
{
    if (!BLAGameState || BLAGameState->RoundPhase == LastObservedPhase)
    {
        return;
    }
    LastObservedPhase = BLAGameState->RoundPhase;
    if (LastObservedPhase == EBLA_RoundPhase::Preparation)
    {
        ResetObjective();
        return;
    }
    if (LastObservedPhase == EBLA_RoundPhase::RoundResult
        || LastObservedPhase == EBLA_RoundPhase::MatchResult
        || LastObservedPhase == EBLA_RoundPhase::Loading)
    {
        CancelInteraction(nullptr, TEXT("RoundTransition"));
    }
}

void ABLAObjectiveManager::RecoverCoreIfNeeded()
{
    if (!DataCore || DataCore->State == EBLA_ObjectiveState::Carried || IsObjectiveInValidArea())
    {
        return;
    }
    DataCore->ResetToHome();
    SetObjectiveState(EBLA_ObjectiveState::Available);
    bCoreRecovered = true;
    LastRecoveryReason = TEXT("OutsideValidArea");
    UE_LOG(LogTemp, Warning, TEXT("BLA_OBJECTIVE_CORE_RELOCATED location=%s"), *DataCore->GetActorLocation().ToCompactString());
}

bool ABLAObjectiveManager::IsInteractorUsable(const ABLACharacterBase* Interactor) const
{
    return Interactor != nullptr && Interactor->GetIsAlive();
}

FBLAMatchRules ABLAObjectiveManager::ResolveRules() const
{
    FBLAMatchRules Rules;
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

void ABLAObjectiveManager::HandleInteractorHealthChanged(float CurrentHealth, float Delta)
{
    if (Delta < 0.0f)
    {
        CancelInteraction(ActiveInteractor, TEXT("Damage"));
    }
}

void ABLAObjectiveManager::HandleInteractorDeath(AActor* InstigatorActor)
{
    CancelInteraction(ActiveInteractor, TEXT("Death"));
}

void ABLAObjectiveManager::HandleCombatantDeath(ABLACharacterBase* DeadCombatant, AActor* InstigatorActor)
{
    if (ActiveInteractor == DeadCombatant)
    {
        CancelInteraction(DeadCombatant, TEXT("Death"));
    }
    HandleCarrierDeath(DeadCombatant);
}
