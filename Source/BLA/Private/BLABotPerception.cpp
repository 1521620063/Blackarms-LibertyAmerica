#include "BLABotPerception.h"

#include "BLACharacterBase.h"

bool UBLABotPerception::ReportStimulus(ABLACharacterBase* Observer, AActor* Source, EBLA_StimulusType Type, FVector StimulusLocation)
{
    ABLACharacterBase* Combatant = Cast<ABLACharacterBase>(Source);
    if (!Observer || !Combatant || !Combatant->GetIsAlive() || Combatant->Team == Observer->Team)
    {
        return false;
    }
    if (Type == EBLA_StimulusType::Hearing
        && FVector::Dist(Observer->GetActorLocation(), StimulusLocation) > HearingRadius)
    {
        // Difficulty: hearing is limited to HearingRadius; damage and sight are not.
        return false;
    }
    TargetActor = Source;
    LastKnownTargetLocation = StimulusLocation;
    LastStimulusType = Type;
    return true;
}

void UBLABotPerception::ForgetTarget()
{
    TargetActor = nullptr;
}
