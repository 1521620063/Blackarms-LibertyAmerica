#include "BLAMapConfig.h"

#include "BLAMapZone.h"

bool ABLAMapConfig::SupportsMode(EBLA_MatchMode Mode) const
{
    return Config && Config->SupportedModes.Contains(Mode);
}

bool ABLAMapConfig::SupportsTeamSize(int32 TeamSize) const
{
    return Config && Config->SupportedTeamSizes.Contains(TeamSize);
}

int32 ABLAMapConfig::ResolveSupportedTeamSize(int32 Requested) const
{
    const int32 Clamped = FMath::Clamp(Requested, 1, 3);
    if (!Config || Config->SupportedTeamSizes.Num() == 0)
    {
        return Clamped;
    }
    if (Config->SupportedTeamSizes.Contains(Clamped))
    {
        return Clamped;
    }
    // Closest supported size that does not exceed the request, else the smallest supported.
    int32 Best = Config->SupportedTeamSizes[0];
    for (const int32 Candidate : Config->SupportedTeamSizes)
    {
        if (Candidate <= Clamped && Candidate > Best)
        {
            Best = Candidate;
        }
    }
    if (Best > Clamped)
    {
        Best = Config->SupportedTeamSizes[0];
    }
    return FMath::Clamp(Best, 1, 3);
}

ABLAMapZone* ABLAMapConfig::FindZone(EBLA_MapZoneType Type) const
{
    for (const TObjectPtr<ABLAMapZone>& Zone : Zones)
    {
        if (Zone && Zone->ZoneType == Type)
        {
            return Zone;
        }
    }
    return nullptr;
}
