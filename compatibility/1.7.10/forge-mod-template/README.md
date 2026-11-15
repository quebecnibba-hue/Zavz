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
3. In a world with commands enabled, run `/zavzcompat`. The command replies with the mod name, version, and target game version.

## Entry points

- `CompatibilityMod.java` contains the `@Mod` entry point and the standard pre-init/init/post-init lifecycle handlers.
- `CompatibilityCommand.java` provides a harmless server-side command to confirm that Forge loaded the mod.

## Scope

This template is a starting point for ordinary Forge mod development. It is not an injector, CheatBreaker plugin, runtime compatibility patch, or anti-cheat bypass. CheatBreaker does not officially expose a general custom-mod loading API.
