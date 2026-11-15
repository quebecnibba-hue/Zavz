# Standalone Forge 1.7.10 mod template

This is a minimal mod project for a **normal, user-controlled Forge 1.7.10 development installation**. It is deliberately separate from the ZAVZ desktop injector and does not attach to, modify, or load code into CheatBreaker or any other third-party process.

## Toolchain

- Minecraft 1.7.10
- Forge 10.13.4.1614
- Java 8
- ForgeGradle 1.2 (legacy; its old Gradle/repository requirements may need maintenance)

## Build

Use a compatible Gradle 2.x/4.x installation with Java 8, then run:

```sh
gradle setupDecompWorkspace
gradle build
```

The resulting mod JAR is written to `build/libs/`.

## Entry point

`src/main/java/dev/zavz/compat1710/CompatibilityMod.java` contains the `@Mod` entry point and the standard pre-init/init/post-init lifecycle handlers.

## Scope

This template is a starting point for ordinary Forge mod development. It is not an injector, CheatBreaker plugin, runtime compatibility patch, or anti-cheat bypass. CheatBreaker does not officially expose a general custom-mod loading API.
