#include "FPSGameMode.h"

#include "FPSCharacterBase.h"
#include "FPSGameState.h"
#include "FPSPlayerController.h"
#include "FPSPlayerState.h"

AFPSGameMode::AFPSGameMode()
{
    DefaultPawnClass = AFPSPlayerCharacter::StaticClass();
    PlayerControllerClass = AFPSPlayerController::StaticClass();
    PlayerStateClass = AFPSPlayerState::StaticClass();
    GameStateClass = AFPSGameState::StaticClass();
}
