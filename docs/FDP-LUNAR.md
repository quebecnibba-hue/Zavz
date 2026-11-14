<!-- FDPClient Lunar native loader by opZywl | https://lucas-lima.xyz -->
# FDPClient Inject

**FDPClient Inject** loads FDPClient into official Lunar Client 1.8.9, including an already running game. ZAVZ includes its native DLL and also supports Julia.

## Using it

1. Open official **Lunar Client 1.8.9**. Stay in the menu, singleplayer, or multiplayer.
2. Open **JAR** in ZAVZ and choose the FDPClient Inject bundle from any folder. ZAVZ recognizes its contents and selects **FDPClient Inject** automatically. Click **Save selection**.
3. Click **Inject**, then **Inject into running Lunar**. Select the Lunar process and click **Inject**.
4. Keep ZAVZ open until it confirms that FDP loaded. With a new FDP configuration, **Right Control** opens the ClickGUI.

Use a current runtime-compatible FDPClient Inject bundle for an open game. Older startup-only bundles are still selectable; use **Watch next Lunar startup** before launching the game, or select a current bundle. The native loader requires Lunar's Java 17 runtime. Forge keeps its normal mod loading method.

The optional watcher keeps waiting for new game instances and reports readiness after FDP initializes. Existing game processes are skipped when the watcher starts, and each new instance is attempted only once. Running-game injection is available separately through **Inject into running Lunar**.

Manual DLL selection remains available through **Choose DLL**. Use `src/load/fdp-lunar.dll` or leave the bundled loader selected; choose the JAR separately in the JAR window. The DLL is embedded in `ZAVZ.exe` and materialized under `%USERPROFILE%\.zywl\injector` with a content hash, so an older loaded DLL does not block an update. The JAR stays at its selected path. If you move it, select it again.

Select FDPClient Inject on its own. A game process that already has FDP loaded needs to be restarted before loading another build.

## Updating and building

The DLL calls the current bundle's `LunarAgent.agentmain` through the running JRE's `instrument.dll`; it has no fixed path to an old FDP build. New compatible JARs work with the same DLL. Update the selected JAR in the JAR window when installing a new build. Rebuild ZAVZ if the native loader itself changes.

The mirrored DLL source is in `native/fdp-lunar`, with credits to **opZywl**, **lucas-lima.xyz**, and the FDPClient contributors. To rebuild it with Visual Studio 2022 C++ Build Tools, CMake and Java 17 JDK headers:

```powershell
$env:JAVA_HOME = 'C:\path\to\jdk17'
cmake -S native/fdp-lunar -B build/fdp-lunar -G 'Visual Studio 17 2022' -A x64
cmake --build build/fdp-lunar --config Release
Copy-Item build/fdp-lunar/Release/fdp-lunar.dll src/load/fdp-lunar.dll
```

Copy the current FDPClient Inject bundle to `src/load/fdpclient-inject.jar`, then build ZAVZ with `yarn install` and `yarn tauri build --no-bundle`. The JAR is a local build resource and is ignored by Git; the native DLL and its source are included. The normal ZAVZ installer includes the JAR if it is present at build time.

The JavaScript API and CLI use Tauri 2.12 alongside the Rust backend. Keep `yarn.lock` and `src-tauri/Cargo.lock` when rebuilding to preserve the tested dependency versions.

When both source checkouts are siblings, FDPClient's `native/lunar/build-zavz.ps1` checks and builds the current agent and payload, rebuilds and mirrors the DLL, builds ZAVZ, and copies the current Lunar JAR and `ZAVZ.exe` to the Desktop. It never commits or pushes. FDPClient's ordinary Gradle build also refreshes `src/load/fdpclient-inject.jar` in an existing sibling YZYInjector checkout.

## Diagnostics

Each load uses `%USERPROFILE%\.zywl\injector\plans\<pid>.ini`. Its result becomes `ok` only after FDP confirms readiness. Runtime delivery preserves the loaded class schemas and stores mixin additions in companion classes. FDP preload and resource initialization use Minecraft's task queue; failed attachment disables the hooks and restores the original loaded definitions. Game-side details remain in Lunar's profile logs. Native GUI browser issues within FDP's NextGen style are independent of DLL delivery.
