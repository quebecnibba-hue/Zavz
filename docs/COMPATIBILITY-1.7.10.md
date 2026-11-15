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


### Build-layout clarification

The external FDPClient Gradle file defines additional source sets named `lunar`, `lunarTest`, and `lunarEngine`. These are separated runtime/Lunar integration and verification source sets, **not** Minecraft-version variants. The sole declared Minecraft workspace in the inspected build remains Forge `1.8.9-11.15.1.2318-1.8.9` with `stable_22` mappings.

The Forge Mixin configuration lists targets across blocks, client settings, entities, GUI, items, networking, rendering, resources, tweaks, and world classes. That breadth is further evidence that a 1.7.10 port would need a separately mapped integration layer; it is not evidence that the existing hooks can be reused unchanged. The source configuration declares `JAVA_8` Mixin compatibility and Java 8 bytecode settings, but those settings alone do not establish Minecraft-version compatibility.

**Important distinction:** Java 8 compatibility describes the generated bytecode/runtime baseline. It does not mean the project supports every Minecraft version that can run on Java 8. Likewise, the `lunar*` Gradle source sets describe packaging/integration boundaries, not support for Minecraft 1.7.10.


### Public release artifact located (15 November 2026)

The upstream FDPClient GitHub release page exposes a downloadable asset named `FDPClient-b17.jar`:

- Release: [b17](https://github.com/SkidderMC/FDPClient/releases/tag/b17)
- Asset: [FDPClient-b17.jar](https://github.com/SkidderMC/FDPClient/releases/download/b17/FDPClient-b17.jar)
- Published asset size: 30,469,691 bytes
- GitHub release asset SHA-256: `c5039ce1e3c7d4545dba2683324c48e2168ac8be925e729def0755b55e630a4c`
- Tag `b17` points to source commit `4f4d0ea75413ab529fc2b8a4595270a33854fb9a`.

I also checked the `build.gradle` and `gradle.properties` at the exact `b17` tag, rather than relying only on the current default branch. The tagged build explicitly declares Minecraft `1.8.9-11.15.1.2318-1.8.9`, mappings `stable_22`, and Java source/target `1.8`. Its JAR manifest configuration identifies a Forge core plugin and Mixin configuration. This independently confirms that the published b17 source build is for the 1.8.9 Forge workspace, not a 1.7.10 build.

**Artifact-inspection limit:** GitHub's release metadata provides the asset's size and SHA-256, but the binary itself was not downloaded or unpacked in this review. Therefore the hash is the publisher's GitHub asset digest, not a locally recomputed hash, and no claim is made that the binary's internal manifest was independently inspected. The source tag and release metadata are enough to establish the declared target version; they do not establish 1.7.10 compatibility.
