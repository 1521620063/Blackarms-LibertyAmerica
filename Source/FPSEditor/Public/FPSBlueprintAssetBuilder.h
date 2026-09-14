#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "FPSBlueprintAssetBuilder.generated.h"

class UBlueprint;
class UBlackboardData;
class UBehaviorTree;

UCLASS()
class FPSEDITOR_API UFPSBlueprintAssetBuilder : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|Editor")
    static bool AddBlueprintInterface(UBlueprint* Blueprint, UClass* InterfaceClass);

    UFUNCTION(BlueprintCallable, Category = "FPS|Editor")
    static bool ConfigureFPSBotBlackboard(UBlackboardData* Blackboard);

    UFUNCTION(BlueprintCallable, Category = "FPS|Editor")
    static bool ConfigureFPSBotBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard, const TArray<UClass*>& TaskClasses, const TArray<UClass*>& ServiceClasses);
};
