#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "BLALanStatics.generated.h"

USTRUCT(BlueprintType)
struct BLA_API FBLALanAddress
{
    GENERATED_BODY()

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN")
    FString Host;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN")
    int32 Port = 7777;

    UPROPERTY(BlueprintReadOnly, Category = "BLA|LAN")
    bool bValid = false;
};

UCLASS()
class BLA_API UBLALanStatics : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()

public:
    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    static bool ParseLANAddress(const FString& Address, FBLALanAddress& OutAddress, FString& OutErrorCode);

    static bool ParseLANAutoStartSeconds(const TCHAR* CommandLine, float& OutSeconds);
    static bool ShouldFireLANAutoStart(float RequestedSeconds, double ElapsedRealSeconds);
    static bool ShouldTreatLANNetworkFailureAsHostLeft(bool bWasConnectedClient, int32 FailureType);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    static FString BuildListenMapURL(const FString& MapPath, int32 Port = 7777);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    static FString GetAdvertiseIPv4();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    static TArray<UWorld*> GetPlayWorlds();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    static FString CapturePIEPlaySettings();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    static bool ConfigurePIEPlaySettings(bool bListenServer, int32 NumberOfClients);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    static bool RestorePIEPlaySettings(const FString& Snapshot);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    static void ApplyLANSelectionToGameInstances(int32 TeamSize, const FString& MatchMapPath);
};
