#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "BLABlueprintAssetBuilder.generated.h"

class UBlueprint;
class UBlackboardData;
class UBehaviorTree;

UCLASS()
class BLAEDITOR_API UBLABlueprintAssetBuilder : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|Editor")
    static bool AddBlueprintInterface(UBlueprint* Blueprint, UClass* InterfaceClass);

    UFUNCTION(BlueprintCallable, Category = "BLA|Editor")
    static bool ConfigureBLABotBlackboard(UBlackboardData* Blackboard);

    UFUNCTION(BlueprintCallable, Category = "BLA|Editor")
    static bool ConfigureBLABotBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard, const TArray<UClass*>& TaskClasses, const TArray<UClass*>& ServiceClasses);

    UFUNCTION(BlueprintCallable, Category = "BLA|Editor")
    static bool ConfigureBLABotTeamBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard,
        const TArray<UClass*>& BaseTaskClasses, const TArray<UClass*>& TeamTaskClasses,
        const TArray<UClass*>& ServiceClasses);

    UFUNCTION(BlueprintCallable, Category = "BLA|Editor")
    static bool ConfigureBLABotObjectiveBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard,
        const TArray<UClass*>& BaseTaskClasses, const TArray<UClass*>& ObjectiveTaskClasses,
        const TArray<UClass*>& ServiceClasses);
};
