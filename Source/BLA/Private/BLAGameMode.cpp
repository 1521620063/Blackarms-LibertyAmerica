#include "BLAGameMode.h"

#include "BLACharacterBase.h"
#include "BLAGameState.h"
#include "BLAPlayerController.h"
#include "BLAPlayerState.h"

ABLAGameMode::ABLAGameMode()
{
    DefaultPawnClass = ABLAPlayerCharacter::StaticClass();
    PlayerControllerClass = ABLAPlayerController::StaticClass();
    PlayerStateClass = ABLAPlayerState::StaticClass();
    GameStateClass = ABLAGameState::StaticClass();
}
