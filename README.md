<div align="center">
<img src="docs/assets/zavz-banner.svg" alt="ZAVZ Injector" width="100%">
<h3>A desktop app for Minecraft 1.8.9 client workflows.</h3>

<a href="https://github.com/opZywl/Zavz/actions/workflows/build.yml?query=event%3Apush"><img src="https://img.shields.io/badge/build-beta-ff0aaf?style=flat-square&labelColor=0b0b0f" alt="Build"></a>
<img src="https://img.shields.io/badge/platform-Windows-ff0aaf?style=flat-square&labelColor=0b0b0f" alt="Platform: Windows">
<img src="https://img.shields.io/badge/Minecraft-1.8.9-ff0aaf?style=flat-square&labelColor=0b0b0f" alt="Minecraft 1.8.9">
<img src="https://img.shields.io/badge/Tauri-2-ff0aaf?style=flat-square&labelColor=0b0b0f" alt="Tauri 2">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-ff0aaf?style=flat-square&labelColor=0b0b0f" alt="License: GPL-3.0"></a>

Website: <a href="https://lucas-lima.xyz">lucas-lima.xyz</a><br>
Latest build: <a href="https://github.com/opZywl/Zavz/actions/workflows/build.yml?query=event%3Apush">beta-version</a><br>
Discord: <a href="https://discord.gg/3XRFGeqEYD">discord.gg/3XRFGeqEYD</a><br>
</div>

## Installing ZAVZ
Click [here](docs/INSTALLING.md) for instructions on how to install ZAVZ.

Antivirus tools can flag injectors, including ZAVZ, because malware uses similar techniques. The source code is in this repository if you want to check it.

## Features
- **Automatic client-process detection** for Lunar Client, Badlion Client, CMCLIENT, CheatBreaker, Forge and Vanilla. Detection identifies the client process; it does not independently verify the Minecraft version.
- **Version support status:** this repository currently documents Minecraft 1.8.9. Minecraft 1.7.10 / CheatBreaker 1.7.10 compatibility is not implemented or verified by this fork.
- **Four injection methods:** Standard (LoadLibrary), Manual Map, Thread Hijack and Reflective.
- **Projects:** [Julia Visuals](https://lucas-lima.xyz/archives/julia-visuals), [FDPClient Inject](https://fdpinfo.github.io).
- **Process watcher** that injects as soon as the selected client starts.
- **One executable:** the native loaders are embedded in `ZAVZ.exe`, built with Tauri 2, React and Rust.

## CheatBreaker 1.7.10 investigation
See [the diagnostic plan](docs/CHEATBREAKER-1.7.10-DIAGNOSTIC.md) for verified compatibility facts, read-only process-detection scope, and limitations. This is not an injector or a verified 1.7.10 payload.

## The staff team
Click [here](docs/TEAM.md) to learn about the ZAVZ team.

## Issues
Found a bug or have an idea for a new feature? You can let us know by clicking [here](https://github.com/opZywl/Zavz/issues) to open an issue.

## License
This project is subject to the [GNU General Public License v3.0](LICENSE).

For those who are unfamiliar with the license, here is a summary of its main points. This is by no means legal advice nor legally binding.

You are allowed to:
- use
- share
- modify

This project entirely or partially for free and even commercially. However, if you share a modified version:

- **You must disclose its source code.**
- **It must also be licensed under the GPL.**

## Setting up a Workspace
Click [here](docs/WORKSPACE.md) for instructions to set up a workspace for ZAVZ. On Windows, `build.cmd` checks the tools, installs the dependencies and builds `ZAVZ.exe` in one step.

## Contributing
Click [here](docs/CONTRIBUTING.md) for information about contributing to ZAVZ. See also [BUILD.md](BUILD.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md) and [CHANGELOG.md](CHANGELOG.md).

<p align="center">
<img src="docs/assets/zavz-logo-animated.svg" alt="ZAVZ" width="112"><br>
<sub>Created by <a href="https://lucas-lima.xyz">Lucas Lima (Zywl)</a> · <a href="https://github.com/opZywl">@opZywl</a></sub>
</p>
