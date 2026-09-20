using UnrealBuildTool;

public class BLA : ModuleRules
{
    public BLA(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

        PublicDependencyModuleNames.AddRange(new string[]
        {
            "Core",
            "CoreUObject",
            "Engine",
            "EnhancedInput",
            "AIModule",
            "GameplayTasks",
            "NavigationSystem",
            "UMG",
            "Sockets"
        });
    }
}
