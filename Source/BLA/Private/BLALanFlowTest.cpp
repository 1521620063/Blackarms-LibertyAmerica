#include "BLALanFlowTest.h"

#include "BLAGameInstance.h"
#include "BLALanStatics.h"
#include "Misc/CommandLine.h"
#include "Misc/Parse.h"

ABLALanFlowTest::ABLALanFlowTest()
{
    PrimaryActorTick.bCanEverTick = false;
}

void ABLALanFlowTest::BeginPlay()
{
    Super::BeginPlay();
    if (FParse::Param(FCommandLine::Get(), TEXT("BLALanContracts")))
    {
        RunAddressContracts();
    }
}

void ABLALanFlowTest::RunAddressContracts()
{
    struct FCase
    {
        const TCHAR* Input;
        bool bExpectValid;
        int32 Port;
        const TCHAR* Error;
    };
    const FCase Cases[] = {
        { TEXT(""), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
        { TEXT("127.0.0.1"), true, 7777, TEXT("") },
        { TEXT("127.0.0.1:7777"), true, 7777, TEXT("") },
        { TEXT("192.168.1.10:9000"), true, 9000, TEXT("") },
        { TEXT("127.0.0.1:abc"), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
        { TEXT("999.1.1.1"), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
        { TEXT("localhost"), false, 7777, TEXT("FLOW_LAN_INVALID_ADDRESS") },
    };

    int32 Failed = 0;
    for (const FCase& Case : Cases)
    {
        FBLALanAddress Parsed;
        FString Error;
        const bool bValid = UBLALanStatics::ParseLANAddress(Case.Input, Parsed, Error);
        if (bValid != Case.bExpectValid || (bValid && Parsed.Port != Case.Port)
            || (!bValid && !Error.StartsWith(Case.Error)))
        {
            ++Failed;
            UE_LOG(LogTemp, Error, TEXT("BLA_LAN_CONTRACT_CASE_FAILED input=%s"), Case.Input);
        }
    }

    UBLAGameInstance* GameInstance = GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
    const FString ListenURL = GameInstance
        ? UBLALanStatics::BuildListenMapURL(GameInstance->MatchMapPath, 7777)
        : FString();
    const bool bListenHasFlag = ListenURL.EndsWith(TEXT("?listen"));
    const bool bOfflineClean = GameInstance && !GameInstance->MatchMapPath.Contains(TEXT("?listen"));
    bool bTravelRequestsClean = false;
    if (GameInstance)
    {
        const bool bPreviousTravelImmediately = GameInstance->bTravelImmediately;
        const bool bPreviousTravelInProgress = GameInstance->bTravelInProgress;
        const FString PreviousTravelRequest = GameInstance->LastTravelRequest;
        const FString PreviousFlowError = GameInstance->LastFlowError;

        GameInstance->bTravelImmediately = false;
        GameInstance->bTravelInProgress = false;
        const bool bOfflineRequested = GameInstance->RequestStartMatch();
        const bool bOfflineRequestClean = bOfflineRequested
            && GameInstance->LastTravelRequest == GameInstance->MatchMapPath
            && !GameInstance->LastTravelRequest.Contains(TEXT("?listen"));

        GameInstance->bTravelInProgress = false;
        const bool bHostRequested = GameInstance->RequestHostLANMatch();
        const bool bHostRequestClean = bHostRequested
            && GameInstance->LastTravelRequest == ListenURL;
        bTravelRequestsClean = bOfflineRequestClean && bHostRequestClean;

        GameInstance->bTravelImmediately = bPreviousTravelImmediately;
        GameInstance->bTravelInProgress = bPreviousTravelInProgress;
        GameInstance->LastTravelRequest = PreviousTravelRequest;
        GameInstance->LastFlowError = PreviousFlowError;
    }

    if (Failed == 0 && bListenHasFlag && bOfflineClean && bTravelRequestsClean)
    {
        bTestSucceeded = true;
        UE_LOG(LogTemp, Display, TEXT("BLA_LAN_CONTRACTS_OK cases=%d listen=1 offline_clean=1"),
            UE_ARRAY_COUNT(Cases));
    }
    else
    {
        bTestFailed = true;
        UE_LOG(LogTemp, Error,
            TEXT("BLA_LAN_CONTRACTS_FAILED failed=%d listen=%d offline_clean=%d travel_requests=%d"),
            Failed, bListenHasFlag ? 1 : 0, bOfflineClean ? 1 : 0, bTravelRequestsClean ? 1 : 0);
    }
}
