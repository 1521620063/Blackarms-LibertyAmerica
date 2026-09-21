#include "BLAUIManager.h"

#include "BLACharacterBase.h"
#include "BLADebugSubsystem.h"
#include "BLAGameInstance.h"
#include "BLAGameModeElimination.h"
#include "BLAGameState.h"
#include "BLALanStatics.h"
#include "BLAPlayerController.h"
#include "BLAHealthComponent.h"
#include "BLAHitFeedbackComponent.h"
#include "BLAObjectiveManager.h"
#include "BLAPlayerState.h"
#include "BLARoundManager.h"
#include "BLASettingsSaveGame.h"
#include "BLATeamManager.h"
#include "BLATeamOrderManager.h"
#include "BLAWeaponComponent.h"
#include "Blueprint/UserWidget.h"
#include "Kismet/GameplayStatics.h"

ABLAUIManager::ABLAUIManager()
{
    PrimaryActorTick.bCanEverTick = true;
}

void ABLAUIManager::BeginPlay()
{
    Super::BeginPlay();
    if (UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        GameInstance->LoadSettings();
    }
    BindPlayerEvents();
    ShowScreen(bStartInMainMenu ? EBLA_UIScreen::MainMenu : EBLA_UIScreen::MatchHUD);
}

void ABLAUIManager::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);
    if (bStartInMainMenu || CurrentScreen == EBLA_UIScreen::MainMenu)
    {
        return;
    }
    if (const UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        if (GameInstance->bTravelInProgress)
        {
            return;
        }
    }
    BindPlayerEvents();
    RefreshHUD();
    EvaluateMatchScreens();
#if !UE_BUILD_SHIPPING
    if (GetWorld() && GetWorld()->GetNetMode() == NM_Client)
    {
        const ABLAGameState* State = GetMatchState();
        const APlayerController* PC = GetWorld()->GetFirstPlayerController();
        const ABLAPlayerState* PlayerState = PC ? PC->GetPlayerState<ABLAPlayerState>() : nullptr;
        if (!bPackagedClientJoinedLogged && State && State->RoundPhase == EBLA_RoundPhase::Waiting && PlayerState)
        {
            bPackagedClientJoinedLogged = true;
            UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_CLIENT_JOINED"));
        }
        if (!bPackagedTeamLogged && PlayerState
            && (PlayerState->Team == EBLA_Team::Attackers || PlayerState->Team == EBLA_Team::Defenders))
        {
            bPackagedTeamLogged = true;
            UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_TEAM team=%s"),
                *StaticEnum<EBLA_Team>()->GetNameStringByValue(static_cast<int64>(PlayerState->Team)));
        }
        if (!bPackagedStartedLogged && State
            && State->RoundPhase != EBLA_RoundPhase::Loading && State->RoundPhase != EBLA_RoundPhase::Waiting)
        {
            int32 HumanCount = 0;
            int32 BotCount = 0;
            for (APlayerState* BaseState : State->PlayerArray)
            {
                if (!BaseState)
                {
                    continue;
                }
                if (BaseState->IsABot())
                {
                    ++BotCount;
                }
                else
                {
                    ++HumanCount;
                }
            }
            bPackagedStartedLogged = true;
            UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_STARTED phase=%d humans=%d bots=%d total=%d"),
                static_cast<int32>(State->RoundPhase), HumanCount, BotCount, HumanCount + BotCount);
        }
    }
    if (!bPackagedStateLogged)
    {
        const ABLAGameState* State = GetMatchState();
        if (State && State->RoundPhase != EBLA_RoundPhase::Loading && State->RoundPhase != EBLA_RoundPhase::Waiting)
        {
            bPackagedStateLogged = true;
            UE_LOG(LogTemp, Display, TEXT("BLA_LAN_PACKAGED_STATE net=%d phase=%d attack_score=%d defend_score=%d living_a=%d living_d=%d"),
                static_cast<int32>(GetWorld()->GetNetMode()), static_cast<int32>(State->RoundPhase),
                State->AttackersScore, State->DefendersScore, State->LivingAttackers, State->LivingDefenders);
        }
    }
#endif
}

void ABLAUIManager::Configure(ABLAGameModeElimination* InGameMode, ABLARoundManager* InRoundManager,
    ABLATeamOrderManager* InOrderManager)
{
    MatchGameMode = InGameMode;
    RoundManager = InRoundManager;
    TeamOrderManager = InOrderManager;
}

void ABLAUIManager::SetObjectiveManager(ABLAObjectiveManager* InObjectiveManager)
{
    ObjectiveManager = InObjectiveManager;
}

UBLAGameInstance* ABLAUIManager::GetBLAGameInstance() const
{
    return GetWorld() ? GetWorld()->GetGameInstance<UBLAGameInstance>() : nullptr;
}

ABLAGameState* ABLAUIManager::GetMatchState() const
{
    if (GetWorld() && GetWorld()->GetNetMode() != NM_Client)
    {
        if (RoundManager && RoundManager->BLAGameState)
        {
            return RoundManager->BLAGameState;
        }
    }
    return GetWorld() ? GetWorld()->GetGameState<ABLAGameState>() : nullptr;
}

EBLA_UIScreen ABLAUIManager::GetCurrentScreen() const
{
    return CurrentScreen;
}

FBLAMatchHUDState ABLAUIManager::GetHUDState() const
{
    return HUDState;
}

ABLARoundManager* ABLAUIManager::GetRoundManager() const
{
    return RoundManager;
}

ABLAObjectiveManager* ABLAUIManager::GetObjectiveManager() const
{
    return ObjectiveManager;
}

UUserWidget* ABLAUIManager::CreateScreenWidget(EBLA_UIScreen Screen)
{
    if (!bCreateWidgets)
    {
        return nullptr;
    }
    APlayerController* Controller = GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr;
    TSubclassOf<UUserWidget> WidgetClass = nullptr;
    switch (Screen)
    {
    case EBLA_UIScreen::MainMenu: WidgetClass = MainMenuClass; break;
    case EBLA_UIScreen::ModeSelect: WidgetClass = ModeSelectClass; break;
    case EBLA_UIScreen::Settings: WidgetClass = SettingsClass; break;
    case EBLA_UIScreen::MatchHUD: WidgetClass = MatchHUDClass; break;
    case EBLA_UIScreen::RoundResult: WidgetClass = RoundResultClass; break;
    case EBLA_UIScreen::MatchResult: WidgetClass = MatchResultClass; break;
    case EBLA_UIScreen::LANWaiting: WidgetClass = LANWaitingClass; break;
    default: break;
    }
    if (!Controller || !WidgetClass)
    {
        return nullptr;
    }
    return CreateWidget<UUserWidget>(Controller, WidgetClass);
}

void ABLAUIManager::ShowScreen(EBLA_UIScreen Screen)
{
    CurrentScreen = Screen;
    UUserWidget* Next = CreateScreenWidget(Screen);
    if (ActiveWidget && ActiveWidget != Next)
    {
        ActiveWidget->RemoveFromParent();
    }
    ActiveWidget = Next;
    if (ActiveWidget)
    {
        ActiveWidget->AddToViewport();
    }
    if (Screen == EBLA_UIScreen::MatchHUD)
    {
        RefreshHUD();
    }
}

void ABLAUIManager::OpenMainMenu()
{
    ShowScreen(EBLA_UIScreen::MainMenu);
}

void ABLAUIManager::OpenModeSelect()
{
    ShowScreen(EBLA_UIScreen::ModeSelect);
}

void ABLAUIManager::OpenSettings()
{
    ShowScreen(EBLA_UIScreen::Settings);
}

void ABLAUIManager::OpenMatchHUD()
{
    ShowScreen(EBLA_UIScreen::MatchHUD);
}

void ABLAUIManager::SelectMatchMode(EBLA_MatchMode Mode)
{
    if (UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        GameInstance->ApplyModeSelection(Mode);
    }
}

void ABLAUIManager::SelectTeamSize(int32 TeamSize)
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance)
    {
        LastErrorText = TEXT("FLOW_NO_GAME_INSTANCE");
        return;
    }
    if (!GameInstance->ApplyTeamSize(TeamSize))
    {
        CopyFlowError(GameInstance);
        return;
    }
    LastErrorText.Empty();
}

void ABLAUIManager::SelectDifficulty(EBLA_DifficultyLevel Level)
{
    if (UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        GameInstance->ApplyDifficultyLevel(Level);
    }
}

bool ABLAUIManager::HostLANMatch()
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance || !GameInstance->RequestHostLANMatch())
    {
        CopyFlowError(GameInstance);
        return false;
    }
    LastErrorText.Empty();
    return true;
}

bool ABLAUIManager::JoinLANMatch(const FString& Address)
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance || !GameInstance->RequestJoinLANMatch(Address))
    {
        CopyFlowError(GameInstance);
        return false;
    }
    LastErrorText.Empty();
    return true;
}

bool ABLAUIManager::StartLANMatch()
{
    ABLAPlayerController* PlayerController = Cast<ABLAPlayerController>(
        GetWorld() ? GetWorld()->GetFirstPlayerController() : nullptr);
    if (!PlayerController)
    {
        LastErrorText = TEXT("FLOW_NO_PLAYER_CONTROLLER");
        return false;
    }
    PlayerController->ServerStartLANMatch();
    LastErrorText.Empty();
    return true;
}

bool ABLAUIManager::LeaveLAN()
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance || !GameInstance->RequestLeaveLAN())
    {
        CopyFlowError(GameInstance);
        return false;
    }
    LastErrorText.Empty();
    return true;
}

FString ABLAUIManager::GetLANAdvertiseAddress() const
{
    return UBLALanStatics::GetAdvertiseIPv4();
}

bool ABLAUIManager::StartMatch()
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance)
    {
        LastErrorText = TEXT("FLOW_NO_GAME_INSTANCE");
        if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
        {
            Debug->ReportEvent(TEXT("FLOW_NO_GAME_INSTANCE"), TEXT("start_match"));
        }
        return false;
    }
    if (!GameInstance->RequestStartMatch())
    {
        CopyFlowError(GameInstance);
        return false;
    }
    LastErrorText.Empty();
    return true;
}

bool ABLAUIManager::RestartMatch()
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (GameInstance && GameInstance->bTravelInProgress)
    {
        GameInstance->ReportFlowFailure(TEXT("FLOW_DUPLICATE_TRAVEL"), TEXT("restart during travel"));
        CopyFlowError(GameInstance);
        return false;
    }
    if (!MatchGameMode || !MatchGameMode->RestartMatch())
    {
        LastErrorText = TEXT("FLOW_RESTART_FAILED");
        if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
        {
            Debug->ReportEvent(TEXT("FLOW_RESTART_FAILED"), TEXT("match_game_mode_missing"));
        }
        return false;
    }
    LastErrorText.Empty();
    ShowScreen(EBLA_UIScreen::MatchHUD);
    return true;
}

bool ABLAUIManager::ReturnToMenu()
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance)
    {
        LastErrorText = TEXT("FLOW_NO_GAME_INSTANCE");
        if (UBLADebugSubsystem* Debug = UBLADebugSubsystem::Get(this))
        {
            Debug->ReportEvent(TEXT("FLOW_NO_GAME_INSTANCE"), TEXT("return_to_menu"));
        }
        return false;
    }
    if (!GameInstance->RequestReturnToMenu())
    {
        CopyFlowError(GameInstance);
        return false;
    }
    ClearMatchReferences();
    ShowScreen(EBLA_UIScreen::MainMenu);
    LastErrorText.Empty();
    return true;
}

void ABLAUIManager::ClearMatchReferences()
{
    MatchGameMode = nullptr;
    RoundManager = nullptr;
    ObjectiveManager = nullptr;
    TeamOrderManager = nullptr;
    BoundFeedbackOwner = nullptr;
    LastResultWinner = EBLA_Team::Neutral;
    LastResultReason = NAME_None;
}

void ABLAUIManager::CopyFlowError(UBLAGameInstance* GameInstance)
{
    LastErrorText = GameInstance && !GameInstance->LastFlowError.IsEmpty()
        ? GameInstance->LastFlowError
        : TEXT("FLOW_UNKNOWN");
}

void ABLAUIManager::ApplySettings(float MouseSensitivity, float FieldOfView, int32 ResolutionWidth,
    int32 ResolutionHeight, bool bFullscreen, float MasterVolume, float MusicVolume, float EffectsVolume,
    bool bSubtitles, bool bCrosshair, bool bColorAssistance)
{
    UBLAGameInstance* GameInstance = GetBLAGameInstance();
    if (!GameInstance)
    {
        return;
    }
    if (!GameInstance->Settings)
    {
        GameInstance->Settings = NewObject<UBLASettingsSaveGame>(GameInstance);
    }
    UBLASettingsSaveGame* Settings = GameInstance->Settings;
    Settings->MouseSensitivity = MouseSensitivity;
    Settings->FieldOfView = FieldOfView;
    Settings->ResolutionWidth = ResolutionWidth;
    Settings->ResolutionHeight = ResolutionHeight;
    Settings->bFullscreen = bFullscreen;
    Settings->MasterVolume = MasterVolume;
    Settings->MusicVolume = MusicVolume;
    Settings->EffectsVolume = EffectsVolume;
    Settings->bSubtitles = bSubtitles;
    Settings->bCrosshair = bCrosshair;
    Settings->bColorAssistance = bColorAssistance;
}

void ABLAUIManager::SaveSettings()
{
    if (UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        GameInstance->SaveSettings();
    }
}

void ABLAUIManager::LoadSettings()
{
    if (UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        GameInstance->LoadSettings();
    }
}

void ABLAUIManager::BindPlayerEvents()
{
    ABLACharacterBase* Player = Cast<ABLACharacterBase>(UGameplayStatics::GetPlayerPawn(this, 0));
    if (!Player || BoundFeedbackOwner == Player || !Player->HitFeedbackComponent)
    {
        return;
    }
    Player->HitFeedbackComponent->OnHitConfirmed.RemoveDynamic(this, &ABLAUIManager::HandleHitConfirmed);
    Player->HitFeedbackComponent->OnHitConfirmed.AddDynamic(this, &ABLAUIManager::HandleHitConfirmed);
    BoundFeedbackOwner = Player;
}

void ABLAUIManager::HandleHitConfirmed(float AppliedDamage, bool bKilled)
{
    NotifyHitConfirmed(AppliedDamage, bKilled);
}

void ABLAUIManager::NotifyHitConfirmed(float AppliedDamage, bool bKilled)
{
    ++HitFeedbackCount;
}

void ABLAUIManager::RefreshHUD()
{
    FBLAMatchHUDState State;
    ABLACharacterBase* Player = Cast<ABLACharacterBase>(UGameplayStatics::GetPlayerPawn(this, 0));
    if (ABLAPlayerState* PlayerState = Player ? Cast<ABLAPlayerState>(Player->GetPlayerState()) : nullptr)
    {
        State.Team = PlayerState->Team;
        State.DeathState = PlayerState->DeathState;
        State.Kills = PlayerState->Kills;
        State.Deaths = PlayerState->Deaths;
        State.DamageDealt = PlayerState->DamageDealt;
        State.ObjectiveContribution = PlayerState->ObjectiveContribution;
    }
    if (Player)
    {
        State.Team = Player->Team;
        State.bAlive = Player->GetIsAlive();
        if (Player->HealthComponent)
        {
            State.Health = Player->HealthComponent->CurrentHealth;
            State.Armor = Player->HealthComponent->ArmorValue;
        }
        if (Player->WeaponComponent)
        {
            State.MagazineAmmo = Player->WeaponComponent->GetCurrentAmmo();
            State.ReserveAmmo = Player->WeaponComponent->GetReserveAmmo();
            FBLAWeaponData WeaponData;
            if (Player->WeaponComponent->GetCurrentWeaponData(WeaponData))
            {
                State.WeaponType = WeaponData.WeaponType;
            }
        }
    }
    if (const ABLAGameState* GameState = GetMatchState())
    {
        State.AttackersScore = GameState->AttackersScore;
        State.DefendersScore = GameState->DefendersScore;
        State.CurrentRound = GameState->CurrentRound;
        State.RoundTimeRemaining = GameState->RoundTimeRemaining;
        State.RoundPhase = GameState->RoundPhase;
        State.MatchMode = GameState->MatchMode;
        State.ObjectiveState = GameState->CurrentObjectiveState;
    }
    if (UBLAGameInstance* GameInstance = GetBLAGameInstance())
    {
        State.bCrosshairEnabled = !GameInstance->Settings || GameInstance->Settings->bCrosshair;
    }
    if (RoundManager && RoundManager->TeamManager)
    {
        ABLATeamManager* Teams = RoundManager->TeamManager;
        const EBLA_Team EnemyTeam = Teams->GetOpposingTeam(State.Team);
        const int32 OwnLiving = Teams->GetLivingCount(State.Team);
        State.LivingTeammates = FMath::Max(0, OwnLiving - (State.bAlive ? 1 : 0));
        State.LivingEnemies = Teams->GetLivingCount(EnemyTeam);
    }
    else if (const ABLAGameState* GameState = GetMatchState())
    {
        const int32 OwnLiving = State.Team == EBLA_Team::Defenders
            ? GameState->LivingDefenders : GameState->LivingAttackers;
        const int32 EnemyLiving = State.Team == EBLA_Team::Defenders
            ? GameState->LivingAttackers : GameState->LivingDefenders;
        State.LivingTeammates = FMath::Max(0, OwnLiving - (State.bAlive ? 1 : 0));
        State.LivingEnemies = EnemyLiving;
    }
    if (TeamOrderManager)
    {
        State.CurrentOrder = TeamOrderManager->CurrentOrder;
    }
    const ABLAObjectiveManager* Objective = ObjectiveManager;
    if (!Objective)
    {
        Objective = Cast<ABLAObjectiveManager>(
            UGameplayStatics::GetActorOfClass(this, ABLAObjectiveManager::StaticClass()));
    }
    if (Objective)
    {
        State.ObjectiveState = Objective->ObjectiveState;
        State.ObjectiveRemaining = Objective->ObjectiveState == EBLA_ObjectiveState::Planting
            || Objective->ObjectiveState == EBLA_ObjectiveState::Defusing
            ? Objective->InteractionRemaining
            : Objective->UploadRemaining;
    }
    HUDState = State;
}

void ABLAUIManager::EvaluateMatchScreens()
{
    const ABLAGameState* GameState = GetMatchState();
    if (!GameState)
    {
        return;
    }
    if (GameState->RoundPhase == EBLA_RoundPhase::Waiting)
    {
        if (CurrentScreen != EBLA_UIScreen::LANWaiting)
        {
            ShowScreen(EBLA_UIScreen::LANWaiting);
        }
        return;
    }
    const bool bMatchResult = GameState->RoundPhase == EBLA_RoundPhase::MatchResult;
    const bool bRoundResult = GameState->RoundPhase == EBLA_RoundPhase::RoundResult;
    const EBLA_UIScreen Target = bMatchResult ? EBLA_UIScreen::MatchResult
        : bRoundResult ? EBLA_UIScreen::RoundResult : EBLA_UIScreen::MatchHUD;
    if (CurrentScreen == Target)
    {
        return;
    }
    if ((bMatchResult || bRoundResult) && RoundManager && RoundManager->LastResult)
    {
        LastResultWinner = RoundManager->LastResult->Winner;
        LastResultReason = RoundManager->LastResult->Reason;
    }
    ShowScreen(Target);
}
