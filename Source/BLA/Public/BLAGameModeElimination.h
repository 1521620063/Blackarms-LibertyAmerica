#pragma once
#include "BLAGameMode.h"
#include "BLAGameplayTypes.h"
#include "BLAGameModeElimination.generated.h"

class ABLARoundManager;
class ABLAMapConfig;
class ABLAPlayerCharacter;
class ABLATeamManager;
class ABLACharacterBase;
class ABLAAIController;
class ABLARoleAssignment;
class ABLATacticalManager;
class ABLATeamOrderManager;
class APlayerState;

UCLASS(Blueprintable)
class BLA_API ABLAGameModeElimination : public ABLAGameMode
{
    GENERATED_BODY()
public:
    ABLAGameModeElimination();

    UFUNCTION(BlueprintCallable, Category = "BLA|Round")
    bool RestartMatch();

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    void EnterLANWaiting();

    UFUNCTION(BlueprintPure, Category = "BLA|LAN")
    bool IsLANListenMatch() const;

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    void RefreshLANRoster();

    UFUNCTION(BlueprintPure, Category = "BLA|LAN")
    bool CanAcceptLANJoin() const;

    UFUNCTION(BlueprintPure, Category = "BLA|LAN")
    int32 CountHumans() const;

    UFUNCTION(BlueprintPure, Category = "BLA|LAN")
    int32 CountHumansOnTeam(EBLA_Team Team) const;

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    bool SetLANTeam(APlayerController* PlayerController, EBLA_Team Team);

    UFUNCTION(BlueprintCallable, Category = "BLA|LAN")
    bool StartLANMatch(APlayerController* Requestor);

    void FillVacantLANSlotsWithBots();

protected:
    virtual void BeginPlay() override;
    virtual void PostLogin(APlayerController* NewPlayer) override;
    virtual void Logout(AController* Exiting) override;
    virtual APawn* SpawnDefaultPawnFor_Implementation(AController* NewPlayer, AActor* StartSpot) override;
    virtual APawn* SpawnDefaultPawnAtTransform_Implementation(
        AController* NewPlayer, const FTransform& SpawnTransform) override;
    virtual bool ShouldStartInMainMenu() const override { return false; }
private:
    void InitializeMatch();
    void AssignNeutralHumansForLAN();
    bool PossessLANHumans();
    void FillLANBots(int32 TeamSize, TArray<ABLAAIController*>& OutAttackerBots, TArray<ABLAAIController*>& OutDefenderBots);
    void LaunchPreparedMatch(int32 TeamSize, EBLA_MatchMode Mode, ABLAMapConfig* MapConfig,
        const TArray<ABLAAIController*>& AttackerBots, const TArray<ABLAAIController*>& DefenderBots,
        ABLAPlayerCharacter* OrderAnchor);
    ABLAMapConfig* FindMapConfig() const;
    ABLAAIController* SpawnBot(EBLA_Team Team, int32 TeamIndex, FName PreferredZone);
    bool EquipLoadout(ABLACharacterBase* Combatant) const;
    FBLAMatchRules ResolveRules(int32 TeamSize) const;
    UPROPERTY() TObjectPtr<ABLATeamManager> TeamManager;
    UPROPERTY() TObjectPtr<ABLARoundManager> RoundManager;
    UPROPERTY() TObjectPtr<ABLATeamOrderManager> TeamOrderManager;
    UPROPERTY() TObjectPtr<ABLARoleAssignment> RoleAssignment;
    UPROPERTY() TObjectPtr<ABLATacticalManager> TacticalManager;
    FTimerHandle InitializeMatchTimer;
};
