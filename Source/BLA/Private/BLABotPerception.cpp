#include "BLABotPerception.h"

#include "BLACharacterBase.h"

bool UBLABotPerception::ReportStimulus(ABLACharacterBase* Observer, AActor* Source, EBLA_StimulusType Type, FVector StimulusLocation)
{
    ABLACharacterBase* Combatant = Cast<ABLACharacterBase>(Source);
    if (!Observer || !Combatant || !Combatant->GetIsAlive() || Combatant->Team == Observer->Team)
    {
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
