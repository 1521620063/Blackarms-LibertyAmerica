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

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    static FString BuildListenMapURL(const FString& MapPath, int32 Port = 7777);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    static FString GetAdvertiseIPv4();
};
