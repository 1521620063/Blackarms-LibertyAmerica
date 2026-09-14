#include "FPSTacticalManager.h"

#include "EngineUtils.h"
#include "GameFramework/Pawn.h"
#include "NavigationSystem.h"

AFPSTacticalPoint* AFPSTacticalManager::FindBestPoint(APawn* Requester, EFPS_TacticalPointType Type, EFPS_Team Team, EFPS_BotRole RequestedRole) const
{
    if (!Requester)
    {
        return nullptr;
    }
    AFPSTacticalPoint* Best = nullptr;
    float BestScore = -TNumericLimits<float>::Max();
    for (TActorIterator<AFPSTacticalPoint> It(GetWorld()); It; ++It)
    {
        AFPSTacticalPoint* Point = *It;
        if (Point->bIsOccupied || Point->PointType != Type || (Point->Team != EFPS_Team::Neutral && Point->Team != Team))
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

AFPSTacticalPoint* AFPSTacticalManager::FindNearestReachablePoint(APawn* Requester, EFPS_Team Team) const
{
    if (!Requester)
    {
        return nullptr;
    }
    UNavigationSystemV1* Navigation = UNavigationSystemV1::GetCurrent(GetWorld());
    AFPSTacticalPoint* Best = nullptr;
    float BestDistance = TNumericLimits<float>::Max();
    for (TActorIterator<AFPSTacticalPoint> It(GetWorld()); It; ++It)
    {
        AFPSTacticalPoint* Point = *It;
        if (Point->bIsOccupied || (Point->Team != EFPS_Team::Neutral && Point->Team != Team))
        {
            continue;
        }
        FNavLocation Projected;
        if (Navigation && !Navigation->ProjectPointToNavigation(Point->GetActorLocation(), Projected))
        {
            continue;
        }
        const float Distance = FVector::DistSquared2D(Requester->GetActorLocation(), Point->GetActorLocation());
        if (Distance < BestDistance)
        {
            BestDistance = Distance;
            Best = Point;
        }
    }
    return Best;
}

bool AFPSTacticalManager::ReservePoint(AFPSTacticalPoint* Point)
{
    if (!Point || Point->bIsOccupied)
    {
        return false;
    }
    Point->bIsOccupied = true;
    return true;
}

void AFPSTacticalManager::ReleasePoint(AFPSTacticalPoint* Point)
{
    if (Point)
    {
        Point->bIsOccupied = false;
    }
}
