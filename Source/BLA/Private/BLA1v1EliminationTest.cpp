#include "BLA1v1EliminationTest.h"
#include "BLACharacterBase.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLARoundManager.h"
#include "BLATeamManager.h"
#include "NavigationPath.h"
#include "NavigationSystem.h"

ABLA1v1EliminationTest::ABLA1v1EliminationTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ABLA1v1EliminationTest::BeginPlay()
{
    Super::BeginPlay();
    UNavigationPath* ArenaPath = UNavigationSystemV1::FindPathToLocationSynchronously(
        GetWorld(), FVector(-1000, -600, 20), FVector(1000, 600, 20), this);
    if (!ArenaPath || !ArenaPath->IsValid() || ArenaPath->PathPoints.Num() < 2)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=navigation")); return;
    }
    ABLAGameState* State = GetWorld()->SpawnActor<ABLAGameState>();
    ABLATeamManager* Teams = GetWorld()->SpawnActor<ABLATeamManager>();
    ABLARoundManager* Rounds = GetWorld()->SpawnActor<ABLARoundManager>();
    ABLAPlayerCharacter* Player = GetWorld()->SpawnActor<ABLAPlayerCharacter>(FVector(-600, -700, 150), FRotator::ZeroRotator);
    ABLABotCharacter* Bot = GetWorld()->SpawnActor<ABLABotCharacter>(FVector(600, -700, 150), FRotator::ZeroRotator);
    if (!State || !Teams || !Rounds || !Player || !Bot)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=spawn")); return;
    }
    Player->Team = EBLA_Team::Attackers; Bot->Team = EBLA_Team::Defenders;
    Rounds->ConfigureManagers(State, Teams);
    if (!Teams->RegisterCombatant(Player) || !Teams->RegisterCombatant(Bot) || Teams->RegisterCombatant(Bot))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=registration")); return;
    }
    FBLAMatchRules Rules; Rules.TeamSize = 1; Rules.RoundsToWin = 3; Rules.SwitchSidesAfterRound = 100;
    Rounds->StartMatch(Rules); Rounds->StartCombatPhase();
    Bot->HealthComponent->ApplyDamage(1000, TEXT("Body"), Player);
    if (State->AttackersScore != 1 || State->RoundPhase != EBLA_RoundPhase::RoundResult || Rounds->EndRound(EBLA_Team::Attackers, TEXT("Duplicate")))
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=single_result")); return;
    }
    Rounds->StartNextRound(); Rounds->StartCombatPhase(); Player->HealthComponent->ApplyDamage(1000, TEXT("Body"), Bot);
    if (State->DefendersScore != 1 || State->AttackersScore != 1)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=win_loss")); return;
    }
    for (int32 Win = 2; Win <= 3; ++Win)
    {
        Rounds->StartNextRound(); Rounds->StartCombatPhase(); Bot->HealthComponent->ApplyDamage(1000, TEXT("Body"), Player);
    }
    if (State->AttackersScore != 3 || State->DefendersScore != 1 || State->RoundPhase != EBLA_RoundPhase::MatchResult)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=match_result")); return;
    }
    Rounds->ResetAllCombatants(); Rounds->ResetAllCombatants();
    if (!Player->GetIsAlive() || !Bot->GetIsAlive())
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_1V1_ELIMINATION_FAILED reason=reset")); return;
    }
    UE_LOG(LogTemp, Display, TEXT("BLA_1V1_ELIMINATION_OK registration=2 phases=preparation_combat result=single score=3_to_1 reset=idempotent match=result navigation=reachable"));
}
