# Standalone Forge 1.7.10 mod template

This is a minimal mod project for a **normal, user-controlled Forge 1.7.10 development installation**. It is deliberately separate from the ZAVZ desktop injector and does not attach to, modify, or load code into CheatBreaker or any other third-party process.

## Toolchain

- Minecraft 1.7.10
- Forge 10.13.4.1614
- Java 8
- Legacy ForgeGradle 1.2; its old Gradle and repository requirements may need maintenance.

## Build

Use Java 8 and a Gradle version compatible with ForgeGradle 1.2. This legacy plugin is not compatible with modern Gradle releases; if the build fails during plugin configuration, use the Gradle version specified by the matching Forge 1.7.10 MDK rather than upgrading the project to the latest Gradle.

Run:

```sh
gradle setupDecompWorkspace
gradle build
```

The resulting mod JAR is written to `build/libs/`.

## Verify in a local Forge world

1. Start a local Forge 1.7.10 client/server with this mod installed in the normal `mods` folder.
2. Check the log for the mod initialization messages.
3. In a world with commands enabled, run `/zavzcompat` to verify that the mod loaded.
4. Run `/zavzcompat features` to list registered passive features and their enabled states.

## Feature architecture and configuration

- `feature/Feature.java` defines the metadata interface for a feature.
- `feature/FeatureRegistry.java` registers features, rejects blank/duplicate IDs, and returns an immutable snapshot.
- `feature/FeatureRegistry.java` also loads and saves each feature's boolean enabled flag through Forge's `Configuration` API.
- `feature/DiagnosticsFeature.java` is a passive example entry.
- `CompatibilityMod.java` creates the registry, loads `config/zavzcompat.cfg` during pre-initialization, and registers the example feature.
- `CompatibilityCommand.java` exposes the registry through the local Forge server command.

The configuration file is created automatically on first launch. Each registered feature gets a `features.<id>.enabled` boolean entry. Changes made to the file are loaded at the next game launch. The enabled flag is configuration state only; it does not make a feature perform an action unless a future, separately reviewed implementation explicitly consumes that state.

New entries should be registered during pre-initialization. Keep feature implementations limited to functionality appropriate for a normal Forge mod; this foundation intentionally contains no game-process injection, memory manipulation, anti-cheat bypass, or gameplay automation.

## Scope

This template is a starting point for ordinary Forge mod development. It is not an injector, CheatBreaker plugin, runtime compatibility patch, or anti-cheat bypass. CheatBreaker does not officially expose a general custom-mod loading API.
