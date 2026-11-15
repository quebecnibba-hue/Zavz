# Minecraft 1.7.10 compatibility baseline

This directory is a standalone Java 8 diagnostic scaffold for the Minecraft 1.7.10 target.

## Target metadata

- Minecraft: `1.7.10`
- Reference Forge baseline: `10.13.4.1614` (documentary target only; ForgeGradle and Minecraft dependencies are not configured in this scaffold)
- Java source/target: `1.8`

## What is implemented

- An exact-version predicate that accepts only `1.7.10`.
- A Gson-backed JSON reader that reads only the top-level string `id` field; nested IDs, malformed JSON, and non-string values are rejected.
- A three-state classifier: `SUPPORTED` for 1.7.10, `UNSUPPORTED` for another valid version id, and `UNKNOWN` when metadata is absent or invalid. This avoids treating missing evidence as a confirmed incompatible version.
- Unit tests covering accepted, rejected, missing, nested, non-string, malformed, empty, and non-object-root metadata, including all three classification states.
- A standalone Gradle Java build, isolated from the existing Tauri application.

## What is not implemented

This is **not** an FDPClient port, a CheatBreaker integration, or a game-process loader. It contains no injection, memory manipulation, anti-cheat bypass, or gameplay automation. The existing 1.8.9 client code cannot be declared compatible merely by changing a version string.

## Run the checks

From this directory, with a Java 8-compatible Gradle installation:

```sh
gradle test
```

The `Forge baseline` above is a planning reference, not evidence that Forge is resolved or compiled here. A real 1.7.10 application port would require a separately maintained 1.7.10 source set, APIs and mappings for that version, dependency resolution, and tests against a legitimate 1.7.10 development/runtime environment. None of those compatibility claims are made by this scaffold.
