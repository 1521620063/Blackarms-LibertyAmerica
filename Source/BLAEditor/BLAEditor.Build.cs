using UnrealBuildTool;

public class BLAEditor : ModuleRules
{
    public BLAEditor(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine"
        });

        PrivateDependencyModuleNames.AddRange(new string[]
        {
            "BLA",
            "UnrealEd",
            "AIModule"
        });
    }
}
