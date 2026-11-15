# CheatBreaker 1.7.10 diagnostic plan

This branch isolates investigation for CheatBreaker 1.7.10. It does not change the existing 1.8.9 payloads or loading methods.

## Verified facts

- The current CheatBreaker download page advertises both Minecraft 1.7.10 and 1.8.9.
- The current CheatBreaker FAQ says users cannot load their own mods; only mods included with CheatBreaker are supported.
- ZAVZ process detection identifies a client process from process/window metadata. That is not proof of the Minecraft version running inside it.
- The existing FDPClient Inject bundle is explicitly tagged for 1.8.9. It must not be relabelled as 1.7.10.

## Diagnostic stages

1. **Find the process**: enumerate candidate CheatBreaker/Minecraft processes without opening handles for memory access.
2. **Collect public process metadata**: PID, executable name, window title, executable path where available, and JVM command-line arguments where the OS grants normal process-query permission.
3. **Classify evidence**:
   - `SUPPORTED_METADATA`: an explicit, well-formed 1.7.10 version/profile value was found.
   - `OTHER_VERSION_METADATA`: an explicit different version was found.
   - `UNKNOWN`: no trustworthy version evidence was found.
4. **Report limitations**: launcher/profile labels are not runtime attestation. The diagnostic must never report a confirmed runtime version based only on a window title or process name.
5. **Stop before loading**: no DLL/JAR injection, remote-thread creation, manual mapping, reflective loading, memory patching, or anti-cheat/protection bypass is implemented here.

## Read-only Windows inventory

Run from PowerShell on Windows:

```powershell
powershell -NoProfile -File .\\tools\\diagnostics\\Get-CheatBreakerProcessInfo.ps1
```

The script lists Java processes and processes whose name or window title clearly contains CheatBreaker. It reports PID, parent PID and parent process name, up to five ancestor process names, executable name, window title, executable path when Windows makes that metadata available, and why the process was included. Parent/ancestor metadata is contextual only; it does not prove client identity. It deliberately does not print the full command line because launch arguments can contain session tokens or other secrets. Every result is classified `UNKNOWN`: process metadata is not proof of the Minecraft version running inside the client. Access-denied or exited processes may have incomplete metadata. The script uses CIM/process metadata only and does not open process memory or load code into another process.

## Supported route

CheatBreaker documents that custom mods are not supported. Use its built-in mod configuration or obtain an approved integration path from the CheatBreaker maintainers. For independent development, use a normal Forge 1.7.10 development client rather than attaching code to the protected CheatBreaker process.

## Acceptance criteria for a future diagnostic utility

- Windows process enumeration is read-only.
- No process memory is read or written.
- Version evidence is reported with its source and confidence.
- Missing or conflicting evidence results in `UNKNOWN`.
- Existing ZAVZ 1.8.9 behavior remains unchanged.
- Tests cover absent, malformed, conflicting, and non-1.7.10 metadata.

## References

- [CheatBreaker downloads](https://cheatbreaker.net/download)
- [CheatBreaker FAQ](https://cheatbreaker.net/faq)
- [CheatBreaker security advisory](https://cheatbreaker.net/security-advisory)
