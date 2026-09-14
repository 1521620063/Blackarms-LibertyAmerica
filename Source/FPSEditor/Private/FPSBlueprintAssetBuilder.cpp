#include "FPSBlueprintAssetBuilder.h"

#include "Engine/Blueprint.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"

bool UFPSBlueprintAssetBuilder::AddBlueprintInterface(UBlueprint* Blueprint, UClass* InterfaceClass)
{
    if (!Blueprint || !InterfaceClass || !InterfaceClass->IsChildOf(UInterface::StaticClass()))
    {
        return false;
    }

    if (Blueprint->GeneratedClass && Blueprint->GeneratedClass->ImplementsInterface(InterfaceClass))
    {
        return true;
    }

    const bool bAdded = FBlueprintEditorUtils::ImplementNewInterface(Blueprint, InterfaceClass->GetClassPathName());
    if (bAdded)
    {
        FKismetEditorUtilities::CompileBlueprint(Blueprint);
    }
    return bAdded;
}
