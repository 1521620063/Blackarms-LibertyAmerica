#include "BLALanStatics.h"

#include "IPAddress.h"
#include "SocketSubsystem.h"

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
