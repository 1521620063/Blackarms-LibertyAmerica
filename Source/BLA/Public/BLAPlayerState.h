#pragma once

#include "BLAGameplayTypes.h"
#include "GameFramework/PlayerState.h"
#include "BLAPlayerState.generated.h"

UCLASS(Blueprintable)
class BLA_API ABLAPlayerState : public APlayerState
{
    GENERATED_BODY()

public:
    ABLAPlayerState();

    UPROPERTY(EditAnywhere, BlueprintReadWrite, Replicated, Category = "BLA")
    EBLA_Team Team = EBLA_Team::Neutral;

    UPROPERTY(BlueprintReadOnly, Replicated, Category = "BLA|LAN")
    bool bIsLANHost = false;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Replicated, Category = "BLA")
    EBLA_DeathState DeathState = EBLA_DeathState::Alive;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Replicated, Category = "BLA")
    int32 Kills = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Replicated, Category = "BLA")
    int32 Deaths = 0;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Replicated, Category = "BLA")
    float DamageDealt = 0.0f;

    UPROPERTY(VisibleAnywhere, BlueprintReadWrite, Replicated, Category = "BLA")
    float ObjectiveContribution = 0.0f;

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
