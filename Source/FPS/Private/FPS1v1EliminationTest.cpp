#include "FPS1v1EliminationTest.h"
#include "FPSCharacterBase.h"
#include "FPSGameState.h"
#include "FPSHealthComponent.h"
#include "FPSRoundManager.h"
#include "FPSTeamManager.h"
#include "NavigationPath.h"
#include "NavigationSystem.h"

AFPS1v1EliminationTest::AFPS1v1EliminationTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

void AFPS1v1EliminationTest::BeginPlay()
{
    Super::BeginPlay();
    UNavigationPath* ArenaPath = UNavigationSystemV1::FindPathToLocationSynchronously(
        GetWorld(), FVector(-1000, -600, 20), FVector(1000, 600, 20), this);
    if (!ArenaPath || !ArenaPath->IsValid() || ArenaPath->PathPoints.Num() < 2)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=navigation")); return;
    }
    AFPSGameState* State = GetWorld()->SpawnActor<AFPSGameState>();
    AFPSTeamManager* Teams = GetWorld()->SpawnActor<AFPSTeamManager>();
    AFPSRoundManager* Rounds = GetWorld()->SpawnActor<AFPSRoundManager>();
    AFPSPlayerCharacter* Player = GetWorld()->SpawnActor<AFPSPlayerCharacter>(FVector(-600, -700, 150), FRotator::ZeroRotator);
    AFPSBotCharacter* Bot = GetWorld()->SpawnActor<AFPSBotCharacter>(FVector(600, -700, 150), FRotator::ZeroRotator);
    if (!State || !Teams || !Rounds || !Player || !Bot)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=spawn")); return;
    }
    Player->Team = EFPS_Team::Attackers; Bot->Team = EFPS_Team::Defenders;
    Rounds->ConfigureManagers(State, Teams);
    if (!Teams->RegisterCombatant(Player) || !Teams->RegisterCombatant(Bot) || Teams->RegisterCombatant(Bot))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=registration")); return;
    }
    FFPSMatchRules Rules; Rules.TeamSize = 1; Rules.RoundsToWin = 3; Rules.SwitchSidesAfterRound = 100;
    Rounds->StartMatch(Rules); Rounds->StartCombatPhase();
    Bot->HealthComponent->ApplyDamage(1000, TEXT("Body"), Player);
    if (State->AttackersScore != 1 || State->RoundPhase != EFPS_RoundPhase::RoundResult || Rounds->EndRound(EFPS_Team::Attackers, TEXT("Duplicate")))
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=single_result")); return;
    }
    Rounds->StartNextRound(); Rounds->StartCombatPhase(); Player->HealthComponent->ApplyDamage(1000, TEXT("Body"), Bot);
    if (State->DefendersScore != 1 || State->AttackersScore != 1)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=win_loss")); return;
    }
    for (int32 Win = 2; Win <= 3; ++Win)
    {
        Rounds->StartNextRound(); Rounds->StartCombatPhase(); Bot->HealthComponent->ApplyDamage(1000, TEXT("Body"), Player);
    }
    if (State->AttackersScore != 3 || State->DefendersScore != 1 || State->RoundPhase != EFPS_RoundPhase::MatchResult)
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=match_result")); return;
    }
    Rounds->ResetAllCombatants(); Rounds->ResetAllCombatants();
    if (!Player->GetIsAlive() || !Bot->GetIsAlive())
    {
        UE_LOG(LogTemp, Error, TEXT("FPS_1V1_ELIMINATION_FAILED reason=reset")); return;
    }
    UE_LOG(LogTemp, Display, TEXT("FPS_1V1_ELIMINATION_OK registration=2 phases=preparation_combat result=single score=3_to_1 reset=idempotent match=result navigation=reachable"));
}
