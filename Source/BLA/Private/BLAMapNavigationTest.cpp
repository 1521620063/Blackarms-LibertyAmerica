#include "BLAMapNavigationTest.h"

#include "BLADataCore.h"
#include "BLAMapConfig.h"
#include "BLAMapZone.h"
#include "BLAObjectiveZone.h"
#include "BLASpawnPoint.h"
#include "BLATacticalPoint.h"
#include "EngineUtils.h"
#include "NavigationPath.h"
#include "NavigationSystem.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

namespace
{
    constexpr int32 StartupTicks = 60;
    constexpr int32 RetryIntervalTicks = 60;
    constexpr int32 MaxTicks = 900;
    constexpr float SpawnSeparation = 200.0f;
}

ABLAMapNavigationTest::ABLAMapNavigationTest()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLAMapNavigationTest::BeginPlay()
{
    Super::BeginPlay();
}

bool ABLAMapNavigationTest::Require(bool bCondition, const FString& Reason)
{
    if (bCondition)
    {
        return true;
    }
    bTestFailed = true;
    FailureReason = Reason;
    return false;
}

bool ABLAMapNavigationTest::HasPath(const FVector& From, const FVector& To)
{
    UNavigationPath* Path = UNavigationSystemV1::FindPathToLocationSynchronously(GetWorld(), From, To, this);
    return Path && Path->IsValid() && Path->PathPoints.Num() >= 2;
}

bool ABLAMapNavigationTest::HasSpawnOverlap(const TArray<ABLASpawnPoint*>& Spawns, const TCHAR* Reason)
{
    for (int32 Index = 0; Index < Spawns.Num(); ++Index)
    {
        for (int32 Other = Index + 1; Other < Spawns.Num(); ++Other)
        {
            const float Distance = FVector::Dist(Spawns[Index]->GetActorLocation(), Spawns[Other]->GetActorLocation());
            if (Distance <= SpawnSeparation)
            {
                return Require(false, Reason);
            }
        }
    }
    return false;
}

void ABLAMapNavigationTest::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bTestSucceeded)
    {
        return;
    }
    // Editor PIE drivers own live LAN sessions; standalone map navigation assertions must
    // not spam or travel while those sessions are running.
    if (FParse::Param(FCommandLine::Get(), TEXT("BLAPieDriver")))
    {
        return;
    }
    ++Ticks;
    if (Ticks < StartupTicks || Ticks % RetryIntervalTicks != 0)
    {
        return;
    }
    // Runtime navigation data can take a moment to appear in PIE: retry until the deadline
    // instead of failing on the first query.
    bTestFailed = false;
    FailureReason.Reset();
    RunChecks();
    if (bTestSucceeded)
    {
        return;
    }
    if (Ticks >= MaxTicks)
    {
        UE_LOG(LogTemp, Error, TEXT("BLA_MAP_NAVIGATION_FAILED reason=%s"), *FailureReason);
    }
}

void ABLAMapNavigationTest::RunChecks()
{
    ABLAMapConfig* Config = nullptr;
    for (TActorIterator<ABLAMapConfig> It(GetWorld()); It; ++It)
    {
        Config = *It;
        break;
    }
    if (!Require(Config != nullptr && Config->Config != nullptr, TEXT("map_config_missing")))
    {
        return;
    }
    const UBLAMapConfigDataAsset* Data = Config->Config;
    if (!Require(Data->SupportedModes.Contains(EBLA_MatchMode::TeamElimination)
        && Data->SupportedModes.Contains(EBLA_MatchMode::DataCoreAttackDefense)
        && Data->SupportedTeamSizes.Num() >= 3, TEXT("map_config_support")))
    {
        return;
    }

    ABLAMapZone* AttackZone = Config->FindZone(EBLA_MapZoneType::AttackSpawn);
    ABLAMapZone* MidZone = Config->FindZone(EBLA_MapZoneType::MidCombatZone);
    ABLAMapZone* ZoneObjective = Config->FindZone(EBLA_MapZoneType::ObjectiveZone);
    ABLAMapZone* DefenseZone = Config->FindZone(EBLA_MapZoneType::DefenseSpawn);
    ABLAMapZone* LeftZone = Config->FindZone(EBLA_MapZoneType::LeftRoute);
    ABLAMapZone* RightZone = Config->FindZone(EBLA_MapZoneType::RightRoute);
    ABLAMapZone* FlankZone = Config->FindZone(EBLA_MapZoneType::FlankZone);
    if (!Require(AttackZone && MidZone && ZoneObjective && DefenseZone && LeftZone && RightZone && FlankZone,
        TEXT("map_zones_missing")))
    {
        return;
    }

    const FVector AttackPoint = AttackZone->GetActorLocation() + FVector(0.0f, 0.0f, 20.0f);
    const FVector DefensePoint = DefenseZone->GetActorLocation() + FVector(0.0f, 0.0f, 20.0f);
    if (!Require(HasPath(AttackPoint, DefensePoint), TEXT("route_attack_defense"))
        || !Require(HasPath(AttackPoint, MidZone->GetActorLocation() + FVector(0.0f, 0.0f, 20.0f)), TEXT("route_mid"))
        || !Require(HasPath(MidZone->GetActorLocation(), ZoneObjective->GetActorLocation()), TEXT("route_objective"))
        || !Require(HasPath(ZoneObjective->GetActorLocation(), DefensePoint), TEXT("route_defense"))
        || !Require(HasPath(AttackPoint, LeftZone->GetActorLocation() + FVector(0.0f, 0.0f, 20.0f)), TEXT("route_left"))
        || !Require(HasPath(AttackPoint, RightZone->GetActorLocation() + FVector(0.0f, 0.0f, 20.0f)), TEXT("route_right"))
        || !Require(HasPath(AttackPoint, FlankZone->GetActorLocation() + FVector(0.0f, 0.0f, 20.0f)), TEXT("route_flank")))
    {
        return;
    }

    int32 TacticalCount = 0;
    for (TActorIterator<ABLATacticalPoint> It(GetWorld()); It; ++It)
    {
        ++TacticalCount;
        if (!Require(HasPath(AttackPoint, It->GetActorLocation()),
            FString::Printf(TEXT("tactical_unreachable %s"), *It->GetName())))
        {
            return;
        }
    }
    if (!Require(TacticalCount >= 7, FString::Printf(TEXT("tactical_points=%d"), TacticalCount)))
    {
        return;
    }

    TArray<ABLASpawnPoint*> AttackerSpawns;
    TArray<ABLASpawnPoint*> DefenderSpawns;
    for (TActorIterator<ABLASpawnPoint> It(GetWorld()); It; ++It)
    {
        if (It->Team == EBLA_Team::Attackers)
        {
            AttackerSpawns.Add(*It);
        }
        else if (It->Team == EBLA_Team::Defenders)
        {
            DefenderSpawns.Add(*It);
        }
    }
    if (!Require(AttackerSpawns.Num() >= 3 && DefenderSpawns.Num() >= 3,
        FString::Printf(TEXT("spawn_counts attack=%d defense=%d"), AttackerSpawns.Num(), DefenderSpawns.Num())))
    {
        return;
    }
    if (HasSpawnOverlap(AttackerSpawns, TEXT("spawn_overlap_attackers"))
        || HasSpawnOverlap(DefenderSpawns, TEXT("spawn_overlap_defenders")))
    {
        return;
    }
    for (const ABLASpawnPoint* AttackerSpawn : AttackerSpawns)
    {
        for (const ABLASpawnPoint* DefenderSpawn : DefenderSpawns)
        {
            FHitResult Hit;
            FCollisionQueryParams Params(SCENE_QUERY_STAT(BLASpawnSight), false);
            const bool bHit = GetWorld()->LineTraceSingleByChannel(Hit,
                AttackerSpawn->GetActorLocation() + FVector(0.0f, 0.0f, 100.0f),
                DefenderSpawn->GetActorLocation() + FVector(0.0f, 0.0f, 100.0f),
                ECC_Visibility, Params);
            if (!Require(bHit, TEXT("spawns_have_direct_sight")))
            {
                return;
            }
        }
    }
    if (Config->ObjectiveZone && Config->DataCore && !Require(
        Config->ObjectiveZone->ContainsLocation(Config->DataCore->GetActorLocation()),
        TEXT("core_outside_objective_zone")))
    {
        return;
    }

    UE_LOG(LogTemp, Display, TEXT("BLA_MAP_NAVIGATION_OK routes=4 zones=8 tactical=%d spawns=%d cover=%d"),
        TacticalCount, AttackerSpawns.Num() + DefenderSpawns.Num(), Data->CoverPieces);
    bTestSucceeded = true;
}
