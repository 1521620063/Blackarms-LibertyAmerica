#include "BLABlueprintAssetBuilder.h"

#include "Engine/Blueprint.h"
#include "BehaviorTree/BlackboardData.h"
#include "BehaviorTree/BehaviorTree.h"
#include "BehaviorTree/Composites/BTComposite_Selector.h"
#include "BehaviorTree/BTService.h"
#include "BehaviorTree/BTTaskNode.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Bool.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Enum.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Name.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Object.h"
#include "BehaviorTree/Blackboard/BlackboardKeyType_Vector.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Kismet2/KismetEditorUtilities.h"

bool UBLABlueprintAssetBuilder::AddBlueprintInterface(UBlueprint* Blueprint, UClass* InterfaceClass)
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

bool UBLABlueprintAssetBuilder::ConfigureBLABotBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard, const TArray<UClass*>& TaskClasses, const TArray<UClass*>& ServiceClasses)
{
    if (!BehaviorTree || !Blackboard || TaskClasses.Num() == 0)
    {
        return false;
    }
    UBTComposite_Selector* Root = NewObject<UBTComposite_Selector>(BehaviorTree, TEXT("PrioritySelector"));
    Root->NodeName = TEXT("Dead Wait, Combat Cover, Recovery, Tactical Move, Patrol Hold");
    for (UClass* TaskClass : TaskClasses)
    {
        if (!TaskClass || !TaskClass->IsChildOf(UBTTaskNode::StaticClass()))
        {
            return false;
        }
        FBTCompositeChild Child;
        Child.ChildTask = NewObject<UBTTaskNode>(Root, TaskClass);
        Root->Children.Add(Child);
    }
    for (UClass* ServiceClass : ServiceClasses)
    {
        if (ServiceClass && ServiceClass->IsChildOf(UBTService::StaticClass()))
        {
            Root->Services.Add(NewObject<UBTService>(Root, ServiceClass));
        }
    }
    BehaviorTree->RootNode = Root;
    BehaviorTree->BlackboardAsset = Blackboard;
    BehaviorTree->MarkPackageDirty();
    return true;
}

bool UBLABlueprintAssetBuilder::ConfigureBLABotObjectiveBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard,
    const TArray<UClass*>& BaseTaskClasses, const TArray<UClass*>& ObjectiveTaskClasses,
    const TArray<UClass*>& ServiceClasses)
{
    if (!BehaviorTree || !Blackboard || BaseTaskClasses.Num() != 1 || ObjectiveTaskClasses.Num() != 5)
    {
        return false;
    }
    UBTComposite_Selector* Root = NewObject<UBTComposite_Selector>(BehaviorTree, TEXT("PrioritySelector"));
    Root->NodeName = TEXT("Combat, Objective Role Tasks");
    if (!BaseTaskClasses[0] || !BaseTaskClasses[0]->IsChildOf(UBTTaskNode::StaticClass()))
    {
        return false;
    }
    FBTCompositeChild CombatChild;
    CombatChild.ChildTask = NewObject<UBTTaskNode>(Root, BaseTaskClasses[0]);
    Root->Children.Add(CombatChild);

    UBTComposite_Selector* ObjectiveSelector = NewObject<UBTComposite_Selector>(Root, TEXT("ObjectiveSelector"));
    ObjectiveSelector->NodeName = TEXT("Seek Core, Carry Core, Plant, Defend Objective, Defuse");
    for (UClass* TaskClass : ObjectiveTaskClasses)
    {
        if (!TaskClass || !TaskClass->IsChildOf(UBTTaskNode::StaticClass()))
        {
            return false;
        }
        FBTCompositeChild ObjectiveChild;
        ObjectiveChild.ChildTask = NewObject<UBTTaskNode>(ObjectiveSelector, TaskClass);
        ObjectiveSelector->Children.Add(ObjectiveChild);
    }
    FBTCompositeChild SelectorChild;
    SelectorChild.ChildComposite = ObjectiveSelector;
    Root->Children.Add(SelectorChild);

    for (UClass* ServiceClass : ServiceClasses)
    {
        if (ServiceClass && ServiceClass->IsChildOf(UBTService::StaticClass()))
        {
            Root->Services.Add(NewObject<UBTService>(Root, ServiceClass));
        }
    }
    BehaviorTree->RootNode = Root;
    BehaviorTree->BlackboardAsset = Blackboard;
    BehaviorTree->MarkPackageDirty();
    return true;
}

bool UBLABlueprintAssetBuilder::ConfigureBLABotBlackboard(UBlackboardData* Blackboard)
{
    if (!Blackboard)
    {
        return false;
    }
    Blackboard->Keys.Reset();
    auto Add = [Blackboard](const TCHAR* Name, UBlackboardKeyType* Type)
    {
        FBlackboardEntry Entry;
        Entry.EntryName = Name;
        Entry.KeyType = Type;
        Blackboard->Keys.Add(Entry);
    };
    Add(TEXT("TargetActor"), NewObject<UBlackboardKeyType_Object>(Blackboard));
    Add(TEXT("LastKnownTargetLocation"), NewObject<UBlackboardKeyType_Vector>(Blackboard));
    Add(TEXT("CurrentTacticalPoint"), NewObject<UBlackboardKeyType_Object>(Blackboard));
    Add(TEXT("CurrentTask"), NewObject<UBlackboardKeyType_Name>(Blackboard));
    Add(TEXT("Team"), NewObject<UBlackboardKeyType_Enum>(Blackboard));
    Add(TEXT("BotRole"), NewObject<UBlackboardKeyType_Enum>(Blackboard));
    Add(TEXT("HasObjectiveCore"), NewObject<UBlackboardKeyType_Bool>(Blackboard));
    Add(TEXT("IsUnderFire"), NewObject<UBlackboardKeyType_Bool>(Blackboard));
    Add(TEXT("IsStuck"), NewObject<UBlackboardKeyType_Bool>(Blackboard));
    Blackboard->UpdateKeyIDs();
    Blackboard->MarkPackageDirty();
    return true;
}

bool UBLABlueprintAssetBuilder::ConfigureBLABotTeamBehaviorTree(UBehaviorTree* BehaviorTree, UBlackboardData* Blackboard,
    const TArray<UClass*>& BaseTaskClasses, const TArray<UClass*>& TeamTaskClasses,
    const TArray<UClass*>& ServiceClasses)
{
    if (!BehaviorTree || !Blackboard || BaseTaskClasses.Num() != 4 || TeamTaskClasses.Num() != 3)
    {
        return false;
    }
    UBTComposite_Selector* Root = NewObject<UBTComposite_Selector>(BehaviorTree, TEXT("PrioritySelector"));
    Root->NodeName = TEXT("Dead Wait, Combat Cover, Recovery, Role and Team Orders");
    for (int32 Index = 0; Index < 3; ++Index)
    {
        if (!BaseTaskClasses[Index] || !BaseTaskClasses[Index]->IsChildOf(UBTTaskNode::StaticClass()))
        {
            return false;
        }
        FBTCompositeChild Child;
        Child.ChildTask = NewObject<UBTTaskNode>(Root, BaseTaskClasses[Index]);
        Root->Children.Add(Child);
    }

    UBTComposite_Selector* TeamSelector = NewObject<UBTComposite_Selector>(Root, TEXT("RoleOrderSelector"));
    TeamSelector->NodeName = TEXT("Follow Player, Guard Point, Attack Route, Fallback Tactical Move");
    TArray<UClass*> RoleTasks = TeamTaskClasses;
    RoleTasks.Add(BaseTaskClasses[3]);
    for (UClass* TaskClass : RoleTasks)
    {
        if (!TaskClass || !TaskClass->IsChildOf(UBTTaskNode::StaticClass()))
        {
            return false;
        }
        FBTCompositeChild RoleChild;
        RoleChild.ChildTask = NewObject<UBTTaskNode>(TeamSelector, TaskClass);
        TeamSelector->Children.Add(RoleChild);
    }
    FBTCompositeChild TeamChild;
    TeamChild.ChildComposite = TeamSelector;
    Root->Children.Add(TeamChild);

    for (UClass* ServiceClass : ServiceClasses)
    {
        if (ServiceClass && ServiceClass->IsChildOf(UBTService::StaticClass()))
        {
            Root->Services.Add(NewObject<UBTService>(Root, ServiceClass));
        }
    }
    BehaviorTree->RootNode = Root;
    BehaviorTree->BlackboardAsset = Blackboard;
    BehaviorTree->MarkPackageDirty();
    return true;
}
