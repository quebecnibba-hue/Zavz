# Minecraft 1.7.10 compatibility baseline

This directory contains two deliberately separate pieces:

- A standalone Java 8 diagnostic scaffold for version metadata checks.
- A minimal Forge 1.7.10 mod template for development in a normal, user-controlled Forge installation.

## Target metadata

- Minecraft: `1.7.10`
- Reference Forge baseline: `10.13.4.1614`
- Java source/target: `1.8`

## Diagnostic scaffold

The root project in this directory implements:

- An exact-version predicate that accepts only `1.7.10`.
- A Gson-backed JSON reader that reads only the top-level string `id` field; nested IDs, malformed JSON, and non-string values are rejected.
- A three-state classifier: `SUPPORTED` for 1.7.10, `UNSUPPORTED` for another valid version id, and `UNKNOWN` when metadata is absent or invalid.
- Unit tests covering accepted, rejected, missing, nested, non-string, malformed, empty, and non-object-root metadata.

The `id` field is launcher/profile metadata, not proof of the running Minecraft version. `SUPPORTED` means only that the supplied metadata ID matches the target string; it does not verify the running process or its actual game classes.

Run its checks from this directory with a Java 8-compatible Gradle installation:

```sh
gradle test
```

## Standalone Forge mod template

See [forge-mod-template](forge-mod-template/README.md). It contains a minimal Forge 1.7.10 `@Mod` entry point, lifecycle handlers, metadata, and a legacy ForgeGradle build file. Its purpose is ordinary mod development in a Forge environment that the user controls.

The template is separate from the diagnostic project. ForgeGradle 1.2 is legacy software; its Gradle and repository requirements may need maintenance before it builds successfully.

## Explicit non-goals

Neither project is an FDPClient port, a CheatBreaker integration, or a game-process loader. There is no injection, memory manipulation, anti-cheat bypass, or gameplay automation. CheatBreaker does not officially expose a general custom-mod loading API. Changing a version string cannot make 1.8.9 code compatible with 1.7.10.

A real client port would require a separately maintained 1.7.10 source set, APIs and mappings for that version, dependency resolution, and tests against a legitimate 1.7.10 development/runtime environment. No runtime compatibility claim is made here.
