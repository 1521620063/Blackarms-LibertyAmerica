#pragma once

#include "GameFramework/PlayerController.h"
#include "BLAGameplayTypes.h"
#include "InputActionValue.h"
#include "BLAPlayerController.generated.h"

class ABLACharacterBase;
class ABLATeamManager;
class ABLATeamOrderManager;

UCLASS(Blueprintable)
class BLA_API ABLAPlayerController : public APlayerController
{
    GENERATED_BODY()

public:
    ABLAPlayerController();
    virtual void Tick(float DeltaSeconds) override;

    UFUNCTION(BlueprintCallable, Category = "BLA|Teams")
    void ConfigureTeamSystems(ABLATeamManager* InTeamManager, ABLATeamOrderManager* InOrderManager);

    UFUNCTION(BlueprintCallable, Category = "BLA|Orders")
    bool IssueTeamOrder(EBLA_TeamOrder Order, FVector TargetLocation, EBLA_RoundPhase Phase, float DurationSeconds = 20.0f);

    UFUNCTION(BlueprintPure, Category = "BLA|Spectator")
    TArray<ABLACharacterBase*> GetLivingFriendlySpectatorTargets();

    UFUNCTION(BlueprintCallable, Category = "BLA|Spectator")
    void CycleSpectatorTarget(int32 Direction);

    UFUNCTION(BlueprintPure, Category = "BLA|Spectator")
    bool IsInTeamSpectatorMode() const { return bInTeamSpectatorMode; }

    UFUNCTION(BlueprintPure, Category = "BLA|Spectator")
    AActor* GetSpectatorTarget() const { return SpectatorTarget; }

    UFUNCTION(Server, Reliable, BlueprintCallable, Category = "BLA|LAN")
    void ServerSetTeam(EBLA_Team Team);

    UFUNCTION(Server, Reliable, BlueprintCallable, Category = "BLA|LAN")
    void ServerStartLANMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    void ClientDebugRequestTeam(EBLA_Team Team);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    void ClientDebugRequestStartLANMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    void ClientDebugTryLocalDamage(float Amount);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    void ClientDebugSwitchWeapon(int32 Slot);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN|Debug", meta = (DevelopmentOnly))
    void ClientDebugRequestObjectiveInteraction(int32 InteractionType);

    UFUNCTION(Server, Reliable)
    void ServerSwitchWeapon(int32 Slot);

    UFUNCTION(Server, Reliable)
    void ServerBeginObjectiveInteraction(int32 InteractionType);

    UFUNCTION(Client, Reliable)
    void ClientNotifyPawnDeath();


    UFUNCTION(Server, Reliable)
    void ServerFireWeapon(FVector TraceStart, FVector AimDirection);

    UFUNCTION(Server, Reliable)
    void ServerReloadWeapon();

    UFUNCTION(Client, Reliable)
    void ClientNotifyFlowError(const FString& Code);

protected:
    virtual void BeginPlay() override;
    virtual void SetupInputComponent() override;
    virtual void OnPossess(APawn* InPawn) override;
    virtual void AcknowledgePossession(APawn* P) override;

    UFUNCTION(BlueprintNativeEvent, Category = "BLA|Input")
    void OnFireRequested();
    virtual void OnFireRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "BLA|Input")
    void OnReloadRequested();
    virtual void OnReloadRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "BLA|Input")
    void OnSwitchPrimaryRequested();
    virtual void OnSwitchPrimaryRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "BLA|Input")
    void OnSwitchSecondaryRequested();
    virtual void OnSwitchSecondaryRequested_Implementation();

    UFUNCTION(BlueprintNativeEvent, Category = "BLA|Input")
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
    void BindControlledCombatant(ABLACharacterBase* Combatant);
    void SelectSpectatorTarget(AActor* Target);

    UFUNCTION()
    void HandleControlledPawnDeath(AActor* InstigatorActor);

    UPROPERTY()
    TObjectPtr<ABLATeamManager> TeamManager;
    UPROPERTY()
    TObjectPtr<ABLATeamOrderManager> TeamOrderManager;
    UPROPERTY()
    TObjectPtr<ABLACharacterBase> ControlledCombatant;
    UPROPERTY()
    TObjectPtr<AActor> SpectatorTarget;
    bool bInTeamSpectatorMode = false;
    int32 CommandIndex = 0;
};
