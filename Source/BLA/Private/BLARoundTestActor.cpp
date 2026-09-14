#include "BLARoundTestActor.h"

#include "BLACharacterBase.h"
#include "BLAGameState.h"
#include "BLAHealthComponent.h"
#include "BLARoundManager.h"
#include "BLATeamManager.h"
#include "BLAWeaponComponent.h"

ABLARoundTestActor::ABLARoundTestActor()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLARoundTestActor::BeginPlay()
{
    Super::BeginPlay();

    TeamManager = GetWorld()->SpawnActor<ABLATeamManager>();
    TestGameState = GetWorld()->SpawnActor<ABLAGameState>();
    RoundManager = GetWorld()->SpawnActor<ABLARoundManager>();
    const FVector TestOrigin = GetActorLocation() + FVector(0.0f, 1000.0f, 500.0f);
    Attacker = GetWorld()->SpawnActor<ABLAPlayerCharacter>(TestOrigin + FVector(-150.0f, 0.0f, 0.0f), FRotator::ZeroRotator);
    Defender = GetWorld()->SpawnActor<ABLABotCharacter>(TestOrigin + FVector(150.0f, 0.0f, 0.0f), FRotator::ZeroRotator);
    if (!TeamManager || !TestGameState || !RoundManager || !Attacker || !Defender)
    {
        Fail(TEXT("spawn"));
        return;
    }

    RoundManager->ConfigureManagers(TestGameState, TeamManager);
    Attacker->Team = EBLA_Team::Attackers;
    Defender->Team = EBLA_Team::Defenders;
    if (!TeamManager->RegisterCombatant(Attacker)
        || !TeamManager->RegisterCombatant(Defender)
        || TeamManager->RegisterCombatant(Attacker)
        || TeamManager->GetLivingCount(EBLA_Team::Attackers) != 1
        || TeamManager->GetLivingCount(EBLA_Team::Defenders) != 1
        || ABLATeamManager::GetOpposingTeam(EBLA_Team::Attackers) != EBLA_Team::Defenders)
    {
        Fail(TEXT("team_registration"));
        return;
    }

    FBLAMatchRules Rules;
    Rules.TeamSize = 1;
    Rules.PreparationSeconds = 15.0f;
    Rules.CombatSeconds = 60.0f;
    Rules.RoundsToWin = 3;
    Rules.SwitchSidesAfterRound = 100;
    RoundManager->StartMatch(Rules);
    if (TestGameState->CurrentRound != 1
        || TestGameState->RoundPhase != EBLA_RoundPhase::Preparation
        || TestGameState->AttackersTeamSize != 1
        || TestGameState->DefendersTeamSize != 1)
    {
        Fail(TEXT("start_match"));
        return;
    }
    RoundManager->StartCombatPhase();
}

void ABLARoundTestActor::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bFinished || !RoundManager)
    {
        return;
    }

    if (Stage == 0)
    {
        Attacker->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Defender);
        if (TestGameState->RoundPhase != EBLA_RoundPhase::RoundResult
            || TestGameState->DefendersScore != 1
            || TestGameState->AttackersScore != 0
            || !RoundManager->LastResult
            || RoundManager->LastResult->Winner != EBLA_Team::Defenders
            || RoundManager->LastResult->Reason != TEXT("Elimination"))
        {
            Fail(TEXT("defender_win"));
            return;
        }
        Attacker->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Defender);
        if (TestGameState->DefendersScore != 1)
        {
            Fail(TEXT("duplicate_round_end"));
            return;
        }
        RoundManager->StartNextRound();
        if (!StartCombatRound())
        {
            return;
        }
        Stage = 1;
    }
    else if (Stage >= 1 && Stage <= 3)
    {
        Defender->HealthComponent->ApplyDamage(1000.0f, TEXT("Body"), Attacker);
        const int32 ExpectedScore = Stage;
        const bool bExpectedMatchResult = ExpectedScore == 3;
        if (TestGameState->AttackersScore != ExpectedScore
            || TestGameState->DefendersScore != 1
            || TestGameState->RoundPhase != (bExpectedMatchResult ? EBLA_RoundPhase::MatchResult : EBLA_RoundPhase::RoundResult))
        {
            Fail(TEXT("attacker_score"));
            return;
        }
        if (bExpectedMatchResult)
        {
            RoundManager->ResetAllCombatants();
            RoundManager->ResetAllCombatants();
            if (!Attacker->GetIsAlive() || !Defender->GetIsAlive()
                || !FMath::IsNearlyEqual(Attacker->HealthComponent->CurrentHealth, 100.0f)
                || !FMath::IsNearlyEqual(Defender->HealthComponent->CurrentHealth, 100.0f))
            {
                Fail(TEXT("idempotent_reset"));
                return;
            }
            UE_LOG(LogTemp, Display, TEXT("BLA_ROUND_FRAMEWORK_OK teams=deduplicated elimination=single score=1_to_3 reset=idempotent match=result"));
            bValidationSucceeded = true;
            bFinished = true;
            SetActorTickEnabled(false);
            return;
        }
        RoundManager->StartNextRound();
        if (!StartCombatRound())
        {
            return;
        }
        ++Stage;
    }
}

bool ABLARoundTestActor::StartCombatRound()
{
    if (!Attacker->GetIsAlive() || !Defender->GetIsAlive()
        || !FMath::IsNearlyEqual(Attacker->HealthComponent->CurrentHealth, 100.0f)
        || !FMath::IsNearlyEqual(Defender->HealthComponent->CurrentHealth, 100.0f)
        || TestGameState->RoundPhase != EBLA_RoundPhase::Preparation)
    {
        Fail(TEXT("next_round_reset"));
        return false;
    }
    RoundManager->StartCombatPhase();
    return true;
}

void ABLARoundTestActor::Fail(const TCHAR* Reason)
{
    UE_LOG(LogTemp, Error, TEXT("BLA_ROUND_FRAMEWORK_FAILED reason=%s"), Reason);
    bValidationFailed = true;
    bFinished = true;
    SetActorTickEnabled(false);
}
