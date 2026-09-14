#pragma once

#include "GameFramework/Actor.h"
#include "BLARoleAssignment.generated.h"

class ABLAAIController;

UCLASS(Blueprintable)
class BLA_API ABLARoleAssignment : public AActor
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|Roles")
    int32 AssignRoles(const TArray<ABLAAIController*>& Controllers) const;
};
