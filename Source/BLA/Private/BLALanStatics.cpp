#include "BLALanStatics.h"
#include "BLAGameInstance.h"
#include "BLAGameState.h"

#include "IPAddress.h"
#include "SocketSubsystem.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "UObject/UObjectIterator.h"
#include "Misc/Parse.h"
#include "Engine/EngineBaseTypes.h"

#if WITH_EDITOR
#include "Settings/LevelEditorPlaySettings.h"
#endif


bool UBLALanStatics::ParseLANAutoStartSeconds(const TCHAR* CommandLine, float& OutSeconds)
{
    OutSeconds = 0.0f;
    if (CommandLine == nullptr)
    {
        return false;
    }
    float Parsed = 0.0f;
    if (!FParse::Value(CommandLine, TEXT("BLALanAutoStart="), Parsed))
    {
        return false;
    }
    OutSeconds = Parsed;
    return true;
}

bool UBLALanStatics::ShouldFireLANAutoStart(float RequestedSeconds, double ElapsedRealSeconds)
{
    return RequestedSeconds > 0.0f && ElapsedRealSeconds >= static_cast<double>(RequestedSeconds);
}

bool UBLALanStatics::ShouldTreatLANNetworkFailureAsHostLeft(bool bWasConnectedClient, int32 FailureType)
{
    if (!bWasConnectedClient)
    {
        return false;
    }
    return FailureType == static_cast<int32>(ENetworkFailure::ConnectionLost)
        || FailureType == static_cast<int32>(ENetworkFailure::ConnectionTimeout)
        || FailureType == static_cast<int32>(ENetworkFailure::FailureReceived);
}

bool UBLALanStatics::ParseLANAddress(
    const FString& Address,
    FBLALanAddress& OutAddress,
    FString& OutErrorCode)
{
    OutAddress = FBLALanAddress{};
    OutErrorCode.Reset();

    const FString Trimmed = Address.TrimStartAndEnd();
    if (Trimmed.IsEmpty())
    {
        OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
        return false;
    }

    FString Host = Trimmed;
    int32 Port = 7777;
    int32 Colon = INDEX_NONE;
    if (Trimmed.FindLastChar(TEXT(':'), Colon))
    {
        Host = Trimmed.Left(Colon);
        const FString PortText = Trimmed.Mid(Colon + 1);
        if (!PortText.IsNumeric())
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
        Port = FCString::Atoi(*PortText);
        if (Port < 1 || Port > 65535)
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
    }

    TArray<FString> Octets;
    Host.ParseIntoArray(Octets, TEXT("."));
    if (Octets.Num() != 4)
    {
        OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
        return false;
    }
    for (const FString& Octet : Octets)
    {
        if (!Octet.IsNumeric())
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
        const int32 Value = FCString::Atoi(*Octet);
        if (Value < 0 || Value > 255)
        {
            OutErrorCode = TEXT("FLOW_LAN_INVALID_ADDRESS");
            return false;
        }
    }

    OutAddress.Host = Host;
    OutAddress.Port = Port;
    OutAddress.bValid = true;
    return true;
}

FString UBLALanStatics::BuildListenMapURL(const FString& MapPath, int32 Port)
{
    (void)Port;
    return FString::Printf(TEXT("%s?listen"), *MapPath);
}

FString UBLALanStatics::GetAdvertiseIPv4()
{
    ISocketSubsystem* SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
    if (SocketSubsystem)
    {
        TArray<TSharedPtr<FInternetAddr>> Addresses;
        if (SocketSubsystem->GetLocalAdapterAddresses(Addresses))
        {
            for (const TSharedPtr<FInternetAddr>& Address : Addresses)
            {
                if (!Address.IsValid())
                {
                    continue;
                }
                const FString Text = Address->ToString(false);
                TArray<FString> Octets;
                Text.ParseIntoArray(Octets, TEXT("."));
                if (Octets.Num() == 4 && !Text.StartsWith(TEXT("127.")))
                {
                    return Text;
                }
            }
        }
    }
    return TEXT("127.0.0.1");
}
TArray<UWorld*> UBLALanStatics::GetPlayWorlds()
{
    TArray<UWorld*> Worlds;
    if (GEngine == nullptr)
    {
        return Worlds;
    }

    for (const FWorldContext& Context : GEngine->GetWorldContexts())
    {
        if (Context.World()
            && (Context.WorldType == EWorldType::PIE
                || Context.WorldType == EWorldType::Game))
        {
            Worlds.Add(Context.World());
        }
    }
    return Worlds;
}

FString UBLALanStatics::CapturePIEPlaySettings()
{
#if WITH_EDITOR
    ULevelEditorPlaySettings* Settings = GetMutableDefault<ULevelEditorPlaySettings>();
    if (Settings == nullptr)
    {
        return FString();
    }

    EPlayNetMode NetMode = PIE_Standalone;
    int32 NumberOfClients = 1;
    bool bRunUnderOneProcess = true;
    Settings->GetPlayNetMode(NetMode);
    Settings->GetPlayNumberOfClients(NumberOfClients);
    Settings->GetRunUnderOneProcess(bRunUnderOneProcess);
    return FString::Printf(
        TEXT("%d|%d|%d|%d"),
        static_cast<int32>(NetMode),
        NumberOfClients,
        bRunUnderOneProcess ? 1 : 0,
        Settings->bLaunchSeparateServer ? 1 : 0);
#else
    return FString();
#endif
}

bool UBLALanStatics::ConfigurePIEPlaySettings(bool bListenServer, int32 NumberOfClients)
{
#if WITH_EDITOR
    ULevelEditorPlaySettings* Settings = GetMutableDefault<ULevelEditorPlaySettings>();
    if (Settings == nullptr)
    {
        return false;
    }

    Settings->SetPlayNetMode(bListenServer ? PIE_ListenServer : PIE_Standalone);
    Settings->SetPlayNumberOfClients(FMath::Clamp(NumberOfClients, 1, 10));
    Settings->SetRunUnderOneProcess(true);
    Settings->bLaunchSeparateServer = false;
    return true;
#else
    return false;
#endif
}

bool UBLALanStatics::RestorePIEPlaySettings(const FString& Snapshot)
{
#if WITH_EDITOR
    TArray<FString> Values;
    Snapshot.ParseIntoArray(Values, TEXT("|"), false);
    if (Values.Num() != 4
        || !Values[0].IsNumeric()
        || !Values[1].IsNumeric()
        || !Values[2].IsNumeric()
        || !Values[3].IsNumeric())
    {
        return false;
    }

    const int32 NetModeValue = FCString::Atoi(*Values[0]);
    if (NetModeValue < static_cast<int32>(PIE_Standalone)
        || NetModeValue > static_cast<int32>(PIE_Client))
    {
        return false;
    }

    ULevelEditorPlaySettings* Settings = GetMutableDefault<ULevelEditorPlaySettings>();
    if (Settings == nullptr)
    {
        return false;
    }

    Settings->SetPlayNetMode(static_cast<EPlayNetMode>(NetModeValue));
    Settings->SetPlayNumberOfClients(FMath::Clamp(FCString::Atoi(*Values[1]), 1, 10));
    Settings->SetRunUnderOneProcess(FCString::Atoi(*Values[2]) != 0);
    Settings->bLaunchSeparateServer = FCString::Atoi(*Values[3]) != 0;
    return true;
#else
    return false;
#endif
}

void UBLALanStatics::ApplyLANSelectionToGameInstances(int32 TeamSize, const FString& MatchMapPath)
{
    TSet<UBLAGameInstance*> Instances;

    auto AddInstance = [&Instances](UObject* Object)
    {
        if (UBLAGameInstance* Instance = Cast<UBLAGameInstance>(Object))
        {
            Instances.Add(Instance);
        }
    };

    AddInstance(GetMutableDefault<UBLAGameInstance>());
    if (UClass* BlueprintClass = LoadClass<UBLAGameInstance>(
            nullptr,
            TEXT("/Game/BLA/Blueprints/Core/BP_BLAGameInstance.BP_BLAGameInstance_C")))
    {
        AddInstance(BlueprintClass->GetDefaultObject());
    }

    if (GEngine)
    {
        for (const FWorldContext& Context : GEngine->GetWorldContexts())
        {
            if (UWorld* World = Context.World())
            {
                AddInstance(World->GetGameInstance());
            }
        }
    }

    for (TObjectIterator<UBLAGameInstance> It; It; ++It)
    {
        AddInstance(*It);
    }

    for (UBLAGameInstance* Instance : Instances)
    {
        if (!IsValid(Instance))
        {
            continue;
        }
        if (!MatchMapPath.IsEmpty())
        {
            Instance->MatchMapPath = MatchMapPath;
        }
        Instance->ApplyTeamSize(TeamSize);
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PIE_SET_TEAM_SIZE class=%s name=%s size=%d"),
            *Instance->GetClass()->GetPathName(),
            *Instance->GetName(),
            Instance->SelectedTeamSize);
    }

    if (GEngine == nullptr)
    {
        return;
    }

    const int32 AppliedSize = FMath::Clamp(TeamSize, 1, 3);
    for (const FWorldContext& Context : GEngine->GetWorldContexts())
    {
        UWorld* World = Context.World();
        if (World == nullptr || !World->IsGameWorld() || World->GetAuthGameMode() == nullptr)
        {
            continue;
        }
        if (ABLAGameState* State = World->GetGameState<ABLAGameState>())
        {
            State->AttackersTeamSize = AppliedSize;
            State->DefendersTeamSize = AppliedSize;
            UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PIE_SET_TEAM_SIZE gs=%s size=%d"),
                *State->GetName(),
                AppliedSize);
        }
    }
}
