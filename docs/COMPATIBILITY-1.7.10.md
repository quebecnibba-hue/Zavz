# Minecraft 1.7.10 compatibility assessment

## Current status

**CheatBreaker 1.7.10 is not supported or verified by this fork.** The current project is built around Minecraft 1.8.9. Detecting a process whose name or window title contains "CheatBreaker" does not prove which Minecraft version that process runs.

## Confirmed 1.8.9-specific dependencies

- The application metadata and user-facing client profiles describe the supported game clients as 1.8.9.
- The bundled FDP Lunar runtime validator in `src-tauri/src/payloads.rs` explicitly requires the JAR manifest value `FDP-Lunar-Bundle: 1.8.9`.
- `src/load/README.md` documents the bundled FDPClient Inject runtime as supporting open Lunar 1.8.9 games.
- The Windows build workflow builds and embeds the existing native FDP Lunar loader. No separate 1.7.10 runtime artifact or compatibility test is declared by that workflow.

## What is still unknown

The repository inspection does not establish that the CheatBreaker 1.8.9 payload, native loader, or its Java-side entry points are binary- or API-compatible with 1.7.10. The video demonstrating the 1.8.9 setup is not evidence of 1.7.10 compatibility.

## Safe next steps for a real port

1. Obtain a legitimate 1.7.10-specific build of the Java project and its documented runtime requirements.
2. Compare its manifest, entry classes, referenced Minecraft/Forge APIs, and supported Java runtime with the current 1.8.9 artifacts.
3. Establish a version-identification test using documented launcher metadata or explicit version arguments. If the running client does not expose a reliable version marker, report the version as unknown rather than guessing.
4. Add automated tests for version identification and payload metadata validation.
5. Run the build and tests against a clean 1.7.10 test installation before claiming support.

This assessment intentionally does not change process injection, DLL loading, memory manipulation, anti-cheat evasion, or other runtime-loading mechanisms. No 1.7.10 compatibility claim should be made until the required artifacts and tests exist.

## Additional source-code findings

The current JAR checks are structural, not a general Minecraft-version detector:

- The standard `Fdpclient` payload is accepted when the expected loader class and a recognized core class (or the declared payload class) exist in the archive. Those checks do not establish whether the bytecode targets Minecraft 1.7.10 or 1.8.9.
- The dedicated `Fdplunar` bundle has a stricter manifest check that requires `FDP-Lunar-Bundle: 1.8.9`, the expected Lunar agent class, and an embedded `FDPClient.jar`.
- The frontend process model currently exposes PID, process name, client kind, and window title. It has no verified Minecraft-version field.
- The build workflow compiles the existing Lunar native component and runs the repository's current tests, but does not define a 1.7.10 test matrix.

Consequently, changing the displayed CheatBreaker label or accepting another JAR filename would not be a compatibility port. The missing evidence is the actual 1.7.10 Java payload, its dependency/API target, and a reproducible test installation.

## Java/Kotlin source review (15 November 2026)

The ZAVZ repository itself contains **no Java or Kotlin source files** and does not track its payload JARs. The `.gitignore` explicitly excludes `src/load/fdpclient-inject.jar`, `src/load/fdp-lunar.jar`, and other built JARs. Therefore the exact Java bytecode selected by a ZAVZ user cannot be inspected from this repository checkout.

The ZAVZ documentation points to a sibling FDPClient source checkout. The public source repository identified by FDPClient's own `CLIENT_GITHUB` metadata is [SkidderMC/FDPClient](https://github.com/SkidderMC/FDPClient). I inspected its current public source metadata and build configuration as a reference; this does **not** prove that it is byte-for-byte the same revision as any local JAR used with ZAVZ.

Confirmed findings in that source repository:

- The Gradle Minecraft target is explicitly `1.8.9-11.15.1.2318-1.8.9` (Minecraft 1.8.9 with Forge 11.15.1.2318).
- The mappings are `stable_22`, which are part of that 1.8.9 Forge workspace.
- Java source/target compatibility is set to 1.8; the main client is predominantly Kotlin.
- The project has a substantial Mixin integration layer (about 90+ Mixin-related Java/Kotlin source and resource files in the current tree), touching client, entity, GUI, rendering, item, network, and world classes.
- The main Forge Mixin configuration is generated from `src/main/resources/fdpclient.forge.mixins.json`; the build also has separate Lunar-specific source sets and artifacts.

### Compatibility conclusion

This is not a simple Java runtime-version change. The client is compiled and mapped against the 1.8.9 Forge/Minecraft API. A 1.7.10 target would require a distinct, version-specific source/build configuration and review of the affected Minecraft/Forge classes, method signatures, fields, mixin targets, and runtime dependencies. The present source metadata provides no evidence of an existing 1.7.10 build.

I have not changed any Java/Kotlin gameplay modules, Mixin hooks, native runtime-loading code, or injection behavior. To verify the exact payload intended for ZAVZ, its actual JAR (or the exact FDPClient commit used to build it) is still required.
