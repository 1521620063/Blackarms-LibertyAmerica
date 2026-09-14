#include "BLADataCoreTest.h"

#include "BLAAIController.h"
#include "BLACharacterBase.h"
#include "BLADataCore.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLAObjectiveManager.h"
#include "BLAObjectiveZone.h"
#include "BLARoundManager.h"
#include "BLATacticalManager.h"
#include "BLATacticalPoint.h"
#include "BLATeamManager.h"

namespace
{
    const FVector TestZoneCenter(400.0f, 0.0f, 150.0f);
    const FVector TestCoreHome(400.0f, 0.0f, 150.0f);
    const FVector TestAttackerStart(-500.0f, 0.0f, 150.0f);
    const FVector TestAttackerDummyStart(-500.0f, 300.0f, 150.0f);
    const FVector TestDefenderStart(-500.0f, -300.0f, 150.0f);
    const FVector TestDefenderDummyStart(-700.0f, -300.0f, 150.0f);
    const FVector TestPlantPointLocation(300.0f, -150.0f, 100.0f);
    const FVector TestDefusePointLocation(500.0f, 150.0f, 100.0f);
    const float PlantSeconds = 5.0f;
    const float DefuseSeconds = 5.0f;
    const float UploadSeconds = 30.0f;
    const float CombatSeconds = 60.0f;
}

ABLADataCoreTest::ABLADataCoreTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

bool ABLADataCoreTest::Require(bool bCondition, const TCHAR* Reason)
{
    if (bCondition)
    {
        return true;
    }
    bTestFailed = true;
    FailureReason = FName(Reason);
    UE_LOG(LogTemp, Error, TEXT("BLA_DATACORE_FAILED reason=%s"), Reason);
    return false;
}

void ABLADataCoreTest::BeginPlay()
{
    Super::BeginPlay();

    ABLAGameState* State = GetWorld()->SpawnActor<ABLAGameState>();
    ABLATeamManager* Teams = GetWorld()->SpawnActor<ABLATeamManager>();
    ABLARoundManager* Rounds = GetWorld()->SpawnActor<ABLARoundManager>();
    ABLAObjectiveManager* Manager = GetWorld()->SpawnActor<ABLAObjectiveManager>();
    ABLADataCore* Core = GetWorld()->SpawnActor<ABLADataCore>(TestCoreHome, FRotator::ZeroRotator);
    ABLAObjectiveZone* Zone = GetWorld()->SpawnActor<ABLAObjectiveZone>(TestZoneCenter, FRotator::ZeroRotator);
    ABLAPlayerCharacter* Attacker = GetWorld()->SpawnActor<ABLAPlayerCharacter>(TestAttackerStart, FRotator::ZeroRotator);
    ABLAPlayerCharacter* AttackerDummy = GetWorld()->SpawnActor<ABLAPlayerCharacter>(TestAttackerDummyStart, FRotator::ZeroRotator);
    ABLABotCharacter* Defender = GetWorld()->SpawnActor<ABLABotCharacter>(TestDefenderStart, FRotator::ZeroRotator);
    ABLABotCharacter* DefenderDummy = GetWorld()->SpawnActor<ABLABotCharacter>(TestDefenderDummyStart, FRotator::ZeroRotator);
    if (!State || !Teams || !Rounds || !Manager || !Core || !Zone || !Attacker || !AttackerDummy || !Defender || !DefenderDummy)
    {
        Require(false, TEXT("spawn"));
        return;
    }

    State->MatchMode = EBLA_MatchMode::DataCoreAttackDefense;
    Attacker->Team = EBLA_Team::Attackers;
    AttackerDummy->Team = EBLA_Team::Attackers;
    Defender->Team = EBLA_Team::Defenders;
    DefenderDummy->Team = EBLA_Team::Defenders;
    Rounds->ConfigureManagers(State, Teams);
    if (!Require(Teams->RegisterCombatant(Attacker) && Teams->RegisterCombatant(AttackerDummy)
        && Teams->RegisterCombatant(Defender) && Teams->RegisterCombatant(DefenderDummy), TEXT("registration")))
    {
        return;
    }

    FBLAMatchRules Rules;
    Rules.TeamSize = 2;
    Rules.PreparationSeconds = 0.0f;
    Rules.CombatSeconds = CombatSeconds;
    Rules.PlantSeconds = PlantSeconds;
    Rules.DefuseSeconds = DefuseSeconds;
    Rules.UploadSeconds = UploadSeconds;
    Rules.RoundsToWin = 3;
    Rules.SwitchSidesAfterRound = 100;
    Rounds->StartMatch(Rules);
    Rounds->StartCombatPhase();
    Manager->Configure(State, Rounds, Core, Zone, Teams);
    Manager->ResetObjective();

    const auto PlaceAtZone = [&](ABLACharacterBase* Combatant)
    {
        Combatant->SetActorLocation(TestZoneCenter);
    };

    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Available
        && State->CurrentObjectiveState == EBLA_ObjectiveState::Available, TEXT("reset_initial")))
    {
        return;
    }
    if (!Require(Core->GetActorLocation().Equals(TestCoreHome, 1.0f), TEXT("reset_initial_home")))
    {
        return;
    }

    PlaceAtZone(Defender);
    PlaceAtZone(Attacker);
    if (!Require(!Manager->BeginPickup(Defender), TEXT("pickup_defender_denied")))
    {
        return;
    }
    if (!Require(Manager->BeginPickup(Attacker), TEXT("pickup_attacker")))
    {
        return;
    }
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Carried && Core->IsCarriedBy(Attacker)
        && State->CurrentObjectiveState == EBLA_ObjectiveState::Carried, TEXT("pickup_state")))
    {
        return;
    }
    if (!Require(!Manager->BeginPickup(Defender), TEXT("pickup_while_carried_denied")))
    {
        return;
    }
    if (!Require(!Manager->BeginDefuse(Defender), TEXT("defuse_before_plant_denied")))
    {
        return;
    }

    Defender->SetActorLocation(TestZoneCenter + FVector(600.0f, 0.0f, 0.0f));
    const FVector DeathLocation = TestZoneCenter + FVector(80.0f, 0.0f, 0.0f);
    Attacker->SetActorLocation(DeathLocation);
    Attacker->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Defender);
    if (!Require(Attacker->HealthComponent->bIsDead, TEXT("carrier_dead")))
    {
        return;
    }
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Dropped && Core->Carrier == nullptr,
        TEXT("drop_on_carrier_death")))
    {
        return;
    }
    if (!Require(FVector::Dist2D(Core->GetActorLocation(), DeathLocation) <= 100.0f, TEXT("drop_location")))
    {
        return;
    }

    Attacker->ResetCombatant();
    Attacker->SetActorLocation(DeathLocation);
    if (!Require(Manager->BeginPickup(Attacker), TEXT("repickup")))
    {
        return;
    }
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Carried, TEXT("repickup_state")))
    {
        return;
    }

    Attacker->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginPlant(Attacker), TEXT("plant_start")))
    {
        return;
    }
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Planting
        && Manager->InteractionRemaining > 0.0f, TEXT("planting_state")))
    {
        return;
    }
    Attacker->SetActorLocation(TestZoneCenter + FVector(60.0f, 0.0f, 0.0f));
    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Carried
        && Manager->LastCancelReason == FName(TEXT("Movement")), TEXT("plant_interrupt_movement")))
    {
        return;
    }
    if (!Require(Manager->InteractionRemaining == 0.0f && !Manager->IsInteractionActive(),
        TEXT("plant_interrupt_movement_cleared")))
    {
        return;
    }

    Attacker->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginPlant(Attacker), TEXT("plant_restart_zone")))
    {
        return;
    }
    Attacker->SetActorLocation(TestZoneCenter + FVector(600.0f, 0.0f, 0.0f));
    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Carried
        && Manager->LastCancelReason == FName(TEXT("LeftZone")), TEXT("plant_interrupt_zone")))
    {
        return;
    }

    Attacker->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginPlant(Attacker), TEXT("plant_restart_damage")))
    {
        return;
    }
    Attacker->HealthComponent->ApplyDamage(10.0f, TEXT("Body"), Defender);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Carried
        && Manager->LastCancelReason == FName(TEXT("Damage")), TEXT("plant_interrupt_damage")))
    {
        return;
    }
    if (!Require(!Attacker->HealthComponent->bIsDead, TEXT("plant_interrupt_damage_survived")))
    {
        return;
    }

    Attacker->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginPlant(Attacker), TEXT("plant_final_start")))
    {
        return;
    }
    Manager->Tick(PlantSeconds + 0.5f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Planted && Manager->IsPlanted(),
        TEXT("planted_state")))
    {
        return;
    }
    if (!Require(!Core->IsCarriedBy(Attacker) && Core->Carrier == nullptr && Zone->ContainsActor(Core),
        TEXT("planted_core_in_zone")))
    {
        return;
    }
    if (!Require(FMath::IsNearlyEqual(Manager->UploadRemaining, UploadSeconds, 0.01f),
        TEXT("planted_upload_ready")))
    {
        return;
    }
    if (!Require(State->RoundPhase == EBLA_RoundPhase::Combat, TEXT("planted_round_continues")))
    {
        return;
    }

    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Uploading, TEXT("uploading_state")))
    {
        return;
    }
    const float UploadBeforeDefuse = Manager->UploadRemaining;

    Defender->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginDefuse(Defender), TEXT("defuse_start")))
    {
        return;
    }
    Manager->Tick(1.0f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Defusing
        && Manager->InteractionRemaining < DefuseSeconds, TEXT("defusing_progress")))
    {
        return;
    }
    Defender->SetActorLocation(TestZoneCenter + FVector(600.0f, 0.0f, 0.0f));
    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Uploading
        && Manager->LastCancelReason == FName(TEXT("LeftZone")), TEXT("defuse_interrupt_zone")))
    {
        return;
    }
    if (!Require(FMath::IsNearlyEqual(Manager->UploadRemaining, UploadBeforeDefuse, 0.01f),
        TEXT("defuse_interrupt_upload_paused")))
    {
        return;
    }

    Defender->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginDefuse(Defender), TEXT("defuse_restart_damage")))
    {
        return;
    }
    Defender->HealthComponent->ApplyDamage(5.0f, TEXT("Body"), Attacker);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Uploading
        && Manager->LastCancelReason == FName(TEXT("Damage")), TEXT("defuse_interrupt_damage")))
    {
        return;
    }
    if (!Require(!Defender->HealthComponent->bIsDead, TEXT("defuse_interrupt_damage_survived")))
    {
        return;
    }

    if (!Require(Manager->BeginDefuse(Defender), TEXT("defuse_final_start")))
    {
        return;
    }
    Manager->Tick(DefuseSeconds + 0.2f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Defused, TEXT("defused_state")))
    {
        return;
    }
    if (!Require(State->RoundPhase == EBLA_RoundPhase::RoundResult && Rounds->LastResult
        && Rounds->LastResult->Winner == EBLA_Team::Defenders
        && Rounds->LastResult->Reason == FName(TEXT("ObjectiveDefused")), TEXT("defuse_round_result")))
    {
        return;
    }
    if (!Require(State->DefendersScore == 1 && State->AttackersScore == 0, TEXT("defuse_score")))
    {
        return;
    }

    Rounds->StartNextRound();
    Manager->Tick(0.0f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Available
        && Core->GetActorLocation().Equals(TestCoreHome, 1.0f), TEXT("round_reset")))
    {
        return;
    }
    if (!Require(State->DefendersScore == 1 && State->RoundPhase == EBLA_RoundPhase::Preparation,
        TEXT("round_reset_preserves_score")))
    {
        return;
    }
    Manager->ResetObjective();
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Available
        && Manager->UploadRemaining == 0.0f && Manager->InteractionRemaining == 0.0f
        && Manager->LastCancelReason == NAME_None, TEXT("reset_idempotent")))
    {
        return;
    }

    Rounds->StartCombatPhase();
    Defender->SetActorLocation(TestZoneCenter + FVector(800.0f, 0.0f, 0.0f));
    Attacker->SetActorLocation(TestCoreHome + FVector(80.0f, 0.0f, 0.0f));
    if (!Require(Manager->BeginPickup(Attacker), TEXT("upload_pickup")))
    {
        return;
    }
    Attacker->SetActorLocation(TestZoneCenter);
    if (!Require(Manager->BeginPlant(Attacker), TEXT("upload_plant_start")))
    {
        return;
    }
    Manager->Tick(PlantSeconds + 0.5f);
    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Uploading, TEXT("upload_state")))
    {
        return;
    }
    Manager->Tick(UploadSeconds + 1.0f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Completed, TEXT("upload_completed")))
    {
        return;
    }
    if (!Require(State->RoundPhase == EBLA_RoundPhase::RoundResult && Rounds->LastResult
        && Rounds->LastResult->Winner == EBLA_Team::Attackers
        && Rounds->LastResult->Reason == FName(TEXT("ObjectiveUploaded")), TEXT("upload_round_result")))
    {
        return;
    }
    if (!Require(State->AttackersScore == 1, TEXT("upload_score")))
    {
        return;
    }

    Rounds->StartNextRound();
    Manager->Tick(0.0f);
    Rounds->StartCombatPhase();
    Attacker->SetActorLocation(TestZoneCenter + FVector(900.0f, 0.0f, 0.0f));
    Defender->SetActorLocation(TestZoneCenter + FVector(-900.0f, 0.0f, 0.0f));
    Defender->HealthComponent->ApplyDamage(60.0f, TEXT("Body"), Attacker);
    if (!Require(!Defender->HealthComponent->bIsDead, TEXT("timeout_defender_survived")))
    {
        return;
    }
    Rounds->Tick(CombatSeconds + 1.0f);
    if (!Require(State->RoundPhase == EBLA_RoundPhase::RoundResult && Rounds->LastResult
        && Rounds->LastResult->Winner == EBLA_Team::Attackers
        && Rounds->LastResult->Reason == FName(TEXT("TimeoutHealth")), TEXT("timeout_round_result")))
    {
        return;
    }
    if (!Require(State->AttackersScore == 2, TEXT("timeout_score")))
    {
        return;
    }

    Rounds->StartNextRound();
    Manager->Tick(0.0f);
    Rounds->StartCombatPhase();

    ABLATacticalManager* Tactics = GetWorld()->SpawnActor<ABLATacticalManager>();
    ABLATacticalPoint* PlantPoint = GetWorld()->SpawnActor<ABLATacticalPoint>(TestPlantPointLocation, FRotator::ZeroRotator);
    ABLATacticalPoint* DefusePoint = GetWorld()->SpawnActor<ABLATacticalPoint>(TestDefusePointLocation, FRotator::ZeroRotator);
    ABLAAIController* AttackerAI = GetWorld()->SpawnActor<ABLAAIController>();
    ABLAAIController* DefenderAI = GetWorld()->SpawnActor<ABLAAIController>();
    ABLABotCharacter* AttackerBot = GetWorld()->SpawnActor<ABLABotCharacter>(TestAttackerStart, FRotator::ZeroRotator);
    ABLABotCharacter* DefenderBot = GetWorld()->SpawnActor<ABLABotCharacter>(TestDefenderStart, FRotator::ZeroRotator);
    if (!Require(Tactics && PlantPoint && DefusePoint && AttackerAI && DefenderAI && AttackerBot && DefenderBot,
        TEXT("ai_spawn")))
    {
        return;
    }
    PlantPoint->PointType = EBLA_TacticalPointType::PlantPoint;
    PlantPoint->PreferredRole = EBLA_BotRole::Assault;
    PlantPoint->Priority = 3.0f;
    DefusePoint->PointType = EBLA_TacticalPointType::DefusePoint;
    DefusePoint->PreferredRole = EBLA_BotRole::Defender;
    DefusePoint->Priority = 3.0f;
    AttackerBot->Team = EBLA_Team::Attackers;
    DefenderBot->Team = EBLA_Team::Defenders;
    AttackerAI->Possess(AttackerBot);
    DefenderAI->Possess(DefenderBot);
    if (!Require(Teams->RegisterCombatant(AttackerBot) && Teams->RegisterCombatant(DefenderBot),
        TEXT("ai_registration")))
    {
        return;
    }
    AttackerAI->ConfigureObjective(Manager, Tactics);
    DefenderAI->ConfigureObjective(Manager, Tactics);

    if (!Require(DefenderAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && DefenderAI->CurrentObjectiveTask == FName(TEXT("GuardObjective")), TEXT("ai_defender_guard")))
    {
        return;
    }
    if (!Require(AttackerAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && AttackerAI->CurrentObjectiveTask == FName(TEXT("SeekCore"))
        && FVector::Dist2D(AttackerAI->DirectiveLocation, Core->GetActorLocation()) <= 100.0f,
        TEXT("ai_attacker_seek")))
    {
        return;
    }

    AttackerBot->SetActorLocation(Core->GetActorLocation() + FVector(60.0f, 0.0f, 0.0f));
    if (!Require(AttackerAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && Manager->ObjectiveState == EBLA_ObjectiveState::Carried, TEXT("ai_attacker_pickup")))
    {
        return;
    }
    if (!Require(DefenderAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && DefenderAI->CurrentObjectiveTask == FName(TEXT("InterceptCarrier")), TEXT("ai_defender_intercept")))
    {
        return;
    }

    Manager->HandleCarrierDeath(AttackerBot);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Dropped, TEXT("ai_core_dropped")))
    {
        return;
    }
    if (!Require(DefenderAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && DefenderAI->CurrentObjectiveTask == FName(TEXT("Investigate"))
        && FVector::Dist2D(DefenderAI->DirectiveLocation, Core->GetActorLocation()) <= 100.0f,
        TEXT("ai_defender_investigate")))
    {
        return;
    }

    AttackerBot->SetActorLocation(Core->GetActorLocation() + FVector(60.0f, 0.0f, 0.0f));
    if (!Require(AttackerAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && Manager->ObjectiveState == EBLA_ObjectiveState::Carried, TEXT("ai_attacker_repickup")))
    {
        return;
    }
    AttackerBot->SetActorLocation(FVector(-200.0f, 0.0f, 150.0f));
    if (!Require(AttackerAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && AttackerAI->CurrentObjectiveTask == FName(TEXT("CarryToPlant"))
        && FVector::Dist2D(AttackerAI->DirectiveLocation, PlantPoint->GetActorLocation()) <= 100.0f,
        TEXT("ai_attacker_carry")))
    {
        return;
    }

    AttackerBot->SetActorLocation(TestZoneCenter);
    if (!Require(AttackerAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && Manager->ObjectiveState == EBLA_ObjectiveState::Planting
        && AttackerAI->CurrentObjectiveTask == FName(TEXT("Plant")), TEXT("ai_attacker_plant")))
    {
        return;
    }
    Manager->Tick(PlantSeconds + 0.5f);
    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Uploading, TEXT("ai_planted_uploading")))
    {
        return;
    }
    if (!Require(AttackerAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && AttackerAI->CurrentObjectiveTask == FName(TEXT("DefendPlant")), TEXT("ai_attacker_defend")))
    {
        return;
    }
    if (!Require(DefenderAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && DefenderAI->CurrentObjectiveTask == FName(TEXT("Defuse")), TEXT("ai_defender_defuse_directive")))
    {
        return;
    }
    DefenderBot->SetActorLocation(TestZoneCenter);
    if (!Require(DefenderAI->ResolveObjectiveDirective(Manager, Tactics, nullptr)
        && Manager->ObjectiveState == EBLA_ObjectiveState::Defusing, TEXT("ai_defender_defuse")))
    {
        return;
    }
    const int32 DefendersScoreBeforeAI = State->DefendersScore;
    Manager->Tick(DefuseSeconds + 0.2f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Defused
        && State->DefendersScore == DefendersScoreBeforeAI + 1
        && State->RoundPhase == EBLA_RoundPhase::RoundResult, TEXT("ai_defuse_round_result")))
    {
        return;
    }

    Rounds->StartNextRound();
    Manager->Tick(0.0f);
    Rounds->StartCombatPhase();
    for (ABLACharacterBase* DefenderMember : Teams->GetTeamMembers(EBLA_Team::Defenders))
    {
        DefenderMember->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Attacker);
    }
    if (!Require(State->RoundPhase == EBLA_RoundPhase::MatchResult && Rounds->LastResult
        && Rounds->LastResult->Winner == EBLA_Team::Attackers
        && Rounds->LastResult->Reason == FName(TEXT("Elimination")), TEXT("elimination_round_result")))
    {
        return;
    }
    if (!Require(State->AttackersScore == 3 && State->DefendersScore == DefendersScoreBeforeAI + 1
        && Rounds->EndRound(EBLA_Team::Defenders, TEXT("Duplicate")) == false,
        TEXT("elimination_match_result")))
    {
        return;
    }

    Manager->ResetObjective();
    Attacker->ResetCombatant();
    Attacker->SetActorLocation(TestCoreHome + FVector(50.0f, 0.0f, 0.0f));
    if (!Require(Manager->BeginPickup(Attacker), TEXT("recovery_pickup")))
    {
        return;
    }
    Attacker->SetActorLocation(FVector(-2000.0f, 0.0f, 300.0f));
    Manager->HandleCarrierDeath(Attacker);
    Manager->Tick(0.1f);
    if (!Require(Manager->ObjectiveState == EBLA_ObjectiveState::Available && Manager->bCoreRecovered
        && Manager->LastRecoveryReason == FName(TEXT("OutsideValidArea")), TEXT("core_recovery_outside_area")))
    {
        return;
    }
    if (!Require(Core->GetActorLocation().Equals(TestCoreHome, 1.0f), TEXT("core_recovery_home")))
    {
        return;
    }

    bTestSucceeded = true;
    UE_LOG(LogTemp, Display, TEXT("BLA_DATACORE_OK pickup=attacker_only drop=carrier_death repickup=1 plant_interrupt=movement_zone_damage plant=1 defuse_interrupt=zone_damage defuse=1 upload=1 timeout=1 elimination=1 reset=idempotent recovery=outside_area authority=manager"));
}
