#pragma once

#include "GameFramework/PlayerController.h"
#include "FPSGameplayTypes.h"
#include "InputActionValue.h"
#include "FPSPlayerController.generated.h"

class AFPSCharacterBase;
class AFPSTeamManager;
class AFPSTeamOrderManager;

UCLASS(Blueprintable)
class FPS_API AFPSPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    AFPSPlayerController();
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable, Category = "FPS|Teams")
    void ConfigureTeamSystems(AFPSTeamManager* InTeamManager, AFPSTeamOrderManager* InOrderManager);

    UFUNCTION(BlueprintCallable, Category = "FPS|Orders")
    bool IssueTeamOrder(EFPS_TeamOrder Order, FVector TargetLocation, EFPS_RoundPhase Phase, float DurationSeconds = 20.0f);

    UFUNCTION(BlueprintPure, Category = "FPS|Spectator")
    TArray<AFPSCharacterBase*> GetLivingFriendlySpectatorTargets() const;

    UFUNCTION(BlueprintCallable, Category = "FPS|Spectator")
    void CycleSpectatorTarget(int32 Direction);

    UFUNCTION(BlueprintPure, Category = "FPS|Spectator")
    bool IsInTeamSpectatorMode() const { return bInTeamSpectatorMode; }

    UFUNCTION(BlueprintPure, Category = "FPS|Spectator")
    AActor* GetSpectatorTarget() const { return SpectatorTarget; }

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void OnPossess(APawn* InPawn) override;

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnFireRequested();
    virtual void OnFireRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnReloadRequested();
    virtual void OnReloadRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnSwitchPrimaryRequested();
    virtual void OnSwitchPrimaryRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnSwitchSecondaryRequested();
    virtual void OnSwitchSecondaryRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "FPS|Input")
    void OnCommandRequested();
    virtual void OnCommandRequested_Implementation();

private:
    void HandleMove(const FInputActionValue& Value);
    void HandleLook(const FInputActionValue& Value);
    void HandleJumpStarted();
    void HandleJumpCompleted();
    void BindInputActions();
    void EnterTeamSpectatorMode();
    void ExitTeamSpectatorMode();
    void BindControlledCombatant(AFPSCharacterBase* Combatant);
    void SelectSpectatorTarget(AActor* Target);

    UFUNCTION()
    void HandleControlledPawnDeath(AActor* InstigatorActor);

    UPROPERTY()
    TObjectPtr<AFPSTeamManager> TeamManager;
    UPROPERTY()
    TObjectPtr<AFPSTeamOrderManager> TeamOrderManager;
    UPROPERTY()
    TObjectPtr<AFPSCharacterBase> ControlledCombatant;
    UPROPERTY()
    TObjectPtr<AActor> SpectatorTarget;
    bool bInTeamSpectatorMode = false;
    int32 CommandIndex = 0;
};
