#include "BLATacticalManager.h"

#include "BLAAIController.h"
#include "Misc/Crc.h"

#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "NavigationSystem.h"

ABLATacticalPoint* ABLATacticalManager::FindBestPoint(APawn* Requester, EBLA_TacticalPointType Type, EBLA_Team Team,
    EBLA_BotRole RequestedRole, int32 PreferredLane) const
{
    if (!Requester)
    {
        return nullptr;
    }
    ABLATacticalPoint* Best = nullptr;
    float BestScore = -TNumericLimits<float>::Max();
    // Lane 0 = left route, 1 = center, 2 = right. Callers that know a bot's team slot pass the
    // slot so a squad fans out over all three lanes; otherwise the stable name hash is used.
    const int32 RequestedLane = PreferredLane >= 0
        ? PreferredLane % 3
        : static_cast<int32>(FCrc::StrCrc32(*Requester->GetName()) % 3u);
    for (TActorIterator<ABLATacticalPoint> It(GetWorld()); It; ++It)
    {
        ABLATacticalPoint* Point = *It;
        if (Point->PointType != Type || (Point->Team != EBLA_Team::Neutral && Point->Team != Team))
        {
            continue;
        }
        if (Point->bIsOccupied)
        {
            const ABLAAIController* RequesterAI = Cast<ABLAAIController>(Requester->GetController());
            if (!RequesterAI || RequesterAI->ReservedPoint != Point)
            {
                continue;
            }
        }
        const float RoleBonus = Point->PreferredRole == RequestedRole ? 1000.0f : 0.0f;
        float RouteBonus = 0.0f;
        if (Point->PointType == EBLA_TacticalPointType::AttackPoint || Point->PointType == EBLA_TacticalPointType::FlankPoint)
        {
            const float Y = Point->GetActorLocation().Y;
            const int32 PointLane = Y < -250.0f ? 0 : Y > 250.0f ? 2 : 1;
            RouteBonus = PointLane == RequestedLane ? 2500.0f : 0.0f;
        }
        const float Score = Point->Priority * 100.0f + RoleBonus + RouteBonus
            - FVector::DistSquared2D(Requester->GetActorLocation(), Point->GetActorLocation()) * 0.0001f;
        if (Score > BestScore)
        {
            BestScore = Score;
            Best = Point;
        }
    }
    return Best;
}

ABLATacticalPoint* ABLATacticalManager::FindNearestReachablePoint(APawn* Requester, EBLA_Team Team, ABLATacticalPoint* ExcludedPoint) const
{
    if (!Requester)
    {
        return nullptr;
    }
    UNavigationSystemV1* Navigation = UNavigationSystemV1::GetCurrent(GetWorld());
    ABLATacticalPoint* Best = nullptr;
    ABLATacticalPoint* Fallback = nullptr;
    float BestDistance = TNumericLimits<float>::Max();
    float FallbackDistance = TNumericLimits<float>::Max();
    constexpr float MinRecoveryDistance = 300.0f;
    for (TActorIterator<ABLATacticalPoint> It(GetWorld()); It; ++It)
    {
        ABLATacticalPoint* Point = *It;
        if (Point == ExcludedPoint || Point->bIsOccupied || (Point->Team != EBLA_Team::Neutral && Point->Team != Team))
        {
            continue;
        }
        FNavLocation Projected;
        if (Navigation && !Navigation->ProjectPointToNavigation(Point->GetActorLocation(), Projected))
        {
            continue;
        }
        const float Distance = FVector::DistSquared2D(Requester->GetActorLocation(), Point->GetActorLocation());
        // Prefer a recovery point far enough away to actually break the blockage.
        if (Distance >= FMath::Square(MinRecoveryDistance) && Distance < BestDistance)
        {
            BestDistance = Distance;
            Best = Point;
        }
        if (Distance < FallbackDistance)
        {
            FallbackDistance = Distance;
            Fallback = Point;
        }
    }
    return Best ? Best : Fallback;
}

bool ABLATacticalManager::ReservePoint(ABLATacticalPoint* Point)
{
    if (!Point || Point->bIsOccupied)
    {
        return false;
    }
    Point->bIsOccupied = true;
    return true;
}

void ABLATacticalManager::ReleasePoint(ABLATacticalPoint* Point)
{
    if (Point)
    {
        Point->bIsOccupied = false;
    }
}
