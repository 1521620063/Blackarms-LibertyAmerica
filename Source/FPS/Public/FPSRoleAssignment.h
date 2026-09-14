#pragma once

#include "GameFramework/Actor.h"
#include "FPSRoleAssignment.generated.h"

class AFPSAIController;

UCLASS(Blueprintable)
class FPS_API AFPSRoleAssignment : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|Roles")
    int32 AssignRoles(const TArray<AFPSAIController*>& Controllers) const;
};
