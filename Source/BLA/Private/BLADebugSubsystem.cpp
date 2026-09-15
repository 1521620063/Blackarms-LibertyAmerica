#include "BLADebugSubsystem.h"

#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"

void UBLADebugSubsystem::ReportEvent(FName Event, const FString& Details)
{
    EventCounts.FindOrAdd(Event)++;
    const FString Line = Details.IsEmpty() ? Event.ToString() : FString::Printf(TEXT("%s %s"), *Event.ToString(), *Details);
    EventLog.Add(Line);
    UE_LOG(LogTemp, Display, TEXT("%s"), *Line);
}

int32 UBLADebugSubsystem::GetEventCount(FName Event) const
{
    const int32* Count = EventCounts.Find(Event);
    return Count ? *Count : 0;
}

void UBLADebugSubsystem::ClearLog()
{
    EventLog.Reset();
    EventCounts.Reset();
}

UBLADebugSubsystem* UBLADebugSubsystem::Get(const UObject* WorldContextObject)
{
    if (!GEngine || !WorldContextObject)
    {
        return nullptr;
    }
    const UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull);
    if (!World)
    {
        return nullptr;
    }
    UGameInstance* GameInstance = World->GetGameInstance();
    return GameInstance ? GameInstance->GetSubsystem<UBLADebugSubsystem>() : nullptr;
}
