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
