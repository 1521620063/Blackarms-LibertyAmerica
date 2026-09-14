#include "BLATacticalManager.h"

#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "NavigationSystem.h"

ABLATacticalPoint* ABLATacticalManager::FindBestPoint(APawn* Requester, EBLA_TacticalPointType Type, EBLA_Team Team, EBLA_BotRole RequestedRole) const
{
    if (!Requester)
    {
        return nullptr;
    }
    ABLATacticalPoint* Best = nullptr;
    float BestScore = -TNumericLimits<float>::Max();
    for (TActorIterator<ABLATacticalPoint> It(GetWorld()); It; ++It)
    {
        ABLATacticalPoint* Point = *It;
        if (Point->bIsOccupied || Point->PointType != Type || (Point->Team != EBLA_Team::Neutral && Point->Team != Team))
        {
            continue;
        }
        const float RoleBonus = Point->PreferredRole == RequestedRole ? 1000.0f : 0.0f;
        const float Score = Point->Priority * 100.0f + RoleBonus - FVector::DistSquared2D(Requester->GetActorLocation(), Point->GetActorLocation()) * 0.0001f;
        if (Score > BestScore)
        {
            BestScore = Score;
            Best = Point;
        }
    }
    return Best;
}

ABLATacticalPoint* ABLATacticalManager::FindNearestReachablePoint(APawn* Requester, EBLA_Team Team) const
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
        if (Point->bIsOccupied || (Point->Team != EBLA_Team::Neutral && Point->Team != Team))
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
