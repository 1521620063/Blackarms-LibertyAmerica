#include "BLAGameMode.h"

#include "BLACharacterBase.h"
#include "BLAGameState.h"
#include "BLAPlayerController.h"
#include "BLAPlayerState.h"
#include "BLAUIManager.h"
#include "Engine/World.h"

ABLAGameMode::ABLAGameMode()
{
    DefaultPawnClass = ABLAPlayerCharacter::StaticClass();
    PlayerControllerClass = ABLAPlayerController::StaticClass();
    PlayerStateClass = ABLAPlayerState::StaticClass();
    GameStateClass = ABLAGameState::StaticClass();
}

void ABLAGameMode::BeginPlay()
{
    Super::BeginPlay();
    SpawnUIManager();
}

ABLAUIManager* ABLAGameMode::SpawnUIManager()
{
    if (!GetWorld())
    {
        return nullptr;
    }
    UClass* ManagerClass = LoadClass<ABLAUIManager>(
        nullptr, TEXT("/Game/BLA/Blueprints/UI/BP_BLAUIManager.BP_BLAUIManager_C"));
    if (!ManagerClass)
    {
        ManagerClass = ABLAUIManager::StaticClass();
    }
    ABLAUIManager* Manager = GetWorld()->SpawnActorDeferred<ABLAUIManager>(
        ManagerClass, FTransform::Identity, nullptr, nullptr, ESpawnActorCollisionHandlingMethod::AlwaysSpawn);
    if (Manager)
    {
        Manager->bStartInMainMenu = ShouldStartInMainMenu();
        Manager->FinishSpawning(FTransform::Identity);
    }
    UIManager = Manager;
    return Manager;
}
