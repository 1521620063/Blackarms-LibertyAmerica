#pragma once

#include "GameFramework/SaveGame.h"
#include "BLASettingsSaveGame.generated.h"

/**
 * Player settings persisted through the dedicated save object required by Task 10.
 * The UI manager and the GameInstance only read/write this object; no gameplay rule
 * depends on it.
 */
UCLASS(BlueprintType)
class BLA_API UBLASettingsSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    float MouseSensitivity = 1.0f;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    float FieldOfView = 90.0f;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    int32 ResolutionWidth = 1920;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    int32 ResolutionHeight = 1080;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    bool bFullscreen = true;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    float MasterVolume = 1.0f;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    float MusicVolume = 0.8f;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    float EffectsVolume = 1.0f;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    bool bSubtitles = true;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    bool bCrosshair = true;

    UPROPERTY(BlueprintReadWrite, Category = "BLA|Settings")
    bool bColorAssistance = false;
};
