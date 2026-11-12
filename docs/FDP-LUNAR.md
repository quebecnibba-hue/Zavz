<!-- FDPClient Lunar native loader by opZywl | https://lucas-lima.xyz -->
# FDPClient Inject startup loader

The **FDPClient Inject** project loads FDPClient during official Lunar Client 1.8.9 startup. ZAVZ includes its native DLL and also supports Julia.

## Using it

1. Close Minecraft. Remove FDP's `-javaagent` argument from the Lunar profile if it was configured. Keep other JVM arguments.
2. Open **JAR** in ZAVZ and choose the FDPClient Inject bundle from any folder. ZAVZ recognizes its contents and selects **FDPClient Inject** automatically. Click **Save selection**.
3. Open the injection window and click **Watch next Lunar startup**.
4. Start **Lunar Client 1.8.9** from the official launcher. ZAVZ reports success after FDP finishes initializing. With a new FDP configuration, **Right Control** opens its ClickGUI.

The watcher must be armed before the game JVM starts. FDP's mixins add fields and methods, so loading after Minecraft initializes is rejected. The native loader requires Lunar's Java 17 runtime. Other versions and Forge use their existing loading methods.

Manual DLL selection remains available. Use `src/load/fdp-lunar.dll` or **Use bundled FDPClient Inject DLL** in the manual picker; select the JAR separately in the JAR window. The DLL is embedded in `ZAVZ.exe` and materialized under `%USERPROFILE%\.zywl\injector`. The JAR stays at the selected path, which is saved and used directly. You can also edit that path in the JAR window. If you move the file, select it again.

Select FDPClient Inject on its own before starting the watcher.

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

Each load uses `%USERPROFILE%\.zywl\injector\plans\<pid>.ini`. Its result becomes `ok` only after FDP confirms readiness. ZAVZ consumes the result and removes the completed plan. Failures identify unsupported bundles, wrong JVMs, duplicate agents or missed startup timing. Game-side details remain in Lunar's profile logs. Native GUI browser issues within FDP's NextGen style are independent of DLL delivery.
