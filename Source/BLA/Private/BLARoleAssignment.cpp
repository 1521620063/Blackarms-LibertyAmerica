#include "BLARoleAssignment.h"

#include "BLAAIController.h"

int32 ABLARoleAssignment::AssignRoles(const TArray<ABLAAIController*>& Controllers) const
{
    static constexpr EBLA_BotRole Roles[] = {
        EBLA_BotRole::Assault,
        EBLA_BotRole::Support,
        EBLA_BotRole::Defender,
    };

    int32 Assigned = 0;
    for (int32 Index = 0; Index < Controllers.Num() && Index < UE_ARRAY_COUNT(Roles); ++Index)
    {
        if (ABLAAIController* Controller = Controllers[Index])
        {
            Controller->BotRole = Roles[Index];
            ++Assigned;
        }
    }
    return Assigned;
}
