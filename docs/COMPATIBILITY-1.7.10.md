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

The ZAVZ repository does not contain the FDPClient Java/Kotlin gameplay source or track its payload JARs. It now contains a small, separate Java 8 diagnostic scaffold under `compatibility/1.7.10/`; that scaffold only parses launcher version metadata and tests exact version classification. It is not the FDPClient client source and does not implement game features. The `.gitignore` explicitly excludes `src/load/fdpclient-inject.jar`, `src/load/fdp-lunar.jar`, and other built JARs. Therefore the exact Java bytecode selected by a ZAVZ user cannot be inspected from this repository checkout.

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


## Diagnostic scaffold added to this fork

A separate Java 8 diagnostic project now lives in [compatibility/1.7.10](../compatibility/1.7.10/). It records the Minecraft 1.7.10 target and Forge baseline 10.13.4.1614, performs exact version-string matching, and includes unit tests rejecting 1.8.9 and other non-target values. A dedicated GitHub Actions workflow at [compatibility-1.7.10.yml](../.github/workflows/compatibility-1.7.10.yml) runs these tests with Java 8 and Gradle 8.7 when the scaffold changes.

This CI job validates only the diagnostic scaffold. It does not build or test an FDPClient payload, launch CheatBreaker, or establish compatibility of the existing runtime-loading components. The workflow has been committed but its first hosted run has not yet been observed.


### Follow-up source search and CI status (15 November 2026)

A follow-up GitHub commit/code search scoped to `SkidderMC/FDPClient` for the exact string `1.7.10` returned no matching commits or code-search results through the connected GitHub search interface. This is a limited search result, not proof that no private, deleted, or unindexed fork exists. Combined with the inspected b17 build configuration, there is still no verified upstream 1.7.10 build to use as a porting base.

The diagnostic scaffold now also includes `VersionMetadata`, a passive reader for the launcher's version `id` field, with tests for 1.7.10 acceptance and rejection of 1.8.9 or missing metadata. The workflow commit has no reported commit status yet; its tests have therefore **not** been reported as passing. The workflow can also be started manually from the repository's GitHub Actions page using `workflow_dispatch`.


### Strict metadata parser hardening (15 November 2026)

The standalone diagnostic module now uses Gson to parse launcher metadata as JSON rather than searching for the first textual occurrence of the string `"id"`. It accepts only a top-level string property named `id`; nested properties, non-object JSON roots, non-string values, empty input, and malformed JSON produce an unknown/unsupported result. Unit tests cover these cases and whitespace around the version value.

The diagnostic Gradle module declares Gson 2.10.1 and JUnit 4.13.2. Its Forge version constant remains documentary metadata: this project does **not** resolve ForgeGradle, Minecraft 1.7.10, mappings, or CheatBreaker APIs and does not compile a game mod. This separation is intentional; it prevents a version detector from being mistaken for a working game port.

The latest documentation/test changes were committed to `main`. The connected GitHub status endpoint still reports no commit statuses for the latest commit, so the hosted test result remains unverified. A successful metadata-parser test run would validate only this small diagnostic module, not FDPClient or CheatBreaker compatibility.

### Three-state version classification (15 November 2026)

The diagnostic parser now exposes an explicit VersionCompatibility result:

- SUPPORTED: a valid top-level metadata id equals 1.7.10.
- UNSUPPORTED: a valid top-level metadata id exists but names another version, such as 1.8.9.
- UNKNOWN: metadata is absent, malformed, or does not contain a top-level string id.

This avoids conflating missing evidence with a confirmed different Minecraft version. The boolean targetsMinecraft1710 helper remains available and returns true only for SUPPORTED. Tests were added for all three states. Latest commits: e538b1e (enum), dc84440 (classifier), 84a4581 (tests), and 4022ff2 (module documentation).

The connected GitHub endpoints currently return no commit statuses and no pull-request workflow runs for the latest commit. This does not prove that a push-triggered workflow has failed; it means its result is not visible through these endpoints. The code has not been executed in a local or hosted Gradle environment in this session, so test success remains unverified.
Final verification of the three-state change: the test source now contains explicit assertions for SUPPORTED, UNSUPPORTED, and UNKNOWN, and the module README formatting has been checked after correction. The corresponding follow-up commits are b80012f (classification tests) and 7cb641a (README formatting). These are source inspections only; no Gradle execution result is available.
### Additional metadata edge cases (15 November 2026)

VersionMetadataTest now also asserts that null, boolean, and whitespace-only top-level id values classify as UNKNOWN. These cases are intentionally not treated as either a supported or a known unsupported Minecraft version. The test source was re-fetched from the main branch after commit e59e04b to confirm the assertions are present; execution remains unverified.

### Clarification to the source inventory (15 November 2026)

The phrase “no Java or Kotlin source files” above refers specifically to the FDPClient payload/gameplay implementation. The repository does contain Java files in `compatibility/1.7.10/`, added for passive version-metadata diagnostics. Those files do not contain Minecraft/Forge APIs, Mixin hooks, or client gameplay code. This distinction keeps the source inventory accurate without overstating the scaffold's scope.
