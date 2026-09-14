# Blackarms-LibertyAmerica (黑枪-自由美利坚)

Offline tactical team shooter MVP built with Unreal Engine 5.8.2 (CL 56702186) for Windows PC.

Project tag `BLA`: the runtime module is `BLA`, the editor module is `BLAEditor`, content lives under `Content/BLA`, and assets carry the `BLA` tag (`BP_BLACharacterBase`, `WBP_BLAMatchHUD`, `BT_BLABotElimination`, …).

## Open The Project

1. Install Unreal Engine 5.8.2.
2. Open `BlackarmsLibertyAmerica.uproject` from this repository root.
3. Let Unreal compile shaders and discover assets on the first launch.
4. Open `/Game/BLA/Maps/Graybox/L_TestBootstrap` if it is not already loaded.
5. Use Play In Editor to run the project.

The project uses the Blueprint First Person template and Enhanced Input. The Windows target uses DirectX 12 and Shader Model 6 by default.

## Architecture Rule

Do not place gameplay rules in a Level Blueprint. Match truth belongs to GameMode, GameState, PlayerState, and the dedicated managers and components described in the implementation plan. Level Blueprints must remain empty except for editor-only diagnostics explicitly approved by the plan.

## Editor Automation

Editor-only Python scripts live in `Scripts/Editor`. They create and validate Unreal assets; they are not available in PIE or packaged builds.
