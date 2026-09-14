#include "FPSBotPerception.h"

#include "FPSCharacterBase.h"

bool UFPSBotPerception::ReportStimulus(AFPSCharacterBase* Observer, AActor* Source, EFPS_StimulusType Type, FVector StimulusLocation)
{
    AFPSCharacterBase* Combatant = Cast<AFPSCharacterBase>(Source);
    if (!Observer || !Combatant || !Combatant->GetIsAlive() || Combatant->Team == Observer->Team)
    {
        return false;
    }
    TargetActor = Source;
    LastKnownTargetLocation = StimulusLocation;
    LastStimulusType = Type;
    return true;
}

void UFPSBotPerception::ForgetTarget()
{
    TargetActor = nullptr;
}
