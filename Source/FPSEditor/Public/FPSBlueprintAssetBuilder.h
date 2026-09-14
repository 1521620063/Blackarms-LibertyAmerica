#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "FPSBlueprintAssetBuilder.generated.h"

class UBlueprint;

UCLASS()
class FPSEDITOR_API UFPSBlueprintAssetBuilder : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "FPS|Editor")
    static bool AddBlueprintInterface(UBlueprint* Blueprint, UClass* InterfaceClass);
};
