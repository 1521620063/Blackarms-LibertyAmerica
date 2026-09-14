#include "FPSRoleAssignment.h"

#include "FPSAIController.h"

int32 AFPSRoleAssignment::AssignRoles(const TArray<AFPSAIController*>& Controllers) const
{
    static constexpr EFPS_BotRole Roles[] = {
        EFPS_BotRole::Assault,
        EFPS_BotRole::Support,
        EFPS_BotRole::Defender,
    };

    int32 Assigned = 0;
    for (int32 Index = 0; Index < Controllers.Num() && Index < UE_ARRAY_COUNT(Roles); ++Index)
    {
        if (AFPSAIController* Controller = Controllers[Index])
        {
            Controller->BotRole = Roles[Index];
            ++Assigned;
        }
    }
    return Assigned;
}
