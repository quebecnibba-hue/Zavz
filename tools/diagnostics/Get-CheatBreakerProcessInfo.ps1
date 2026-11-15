# Get-CheatBreakerProcessInfo.ps1
# Read-only process inventory. This script does not open process memory,
# inject code, load modules, or change the target process.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

try {
    $processes = Get-CimInstance -ClassName Win32_Process
} catch {
    Write-Error ("Unable to enumerate process metadata: " + $_.Exception.Message)
    exit 2
}

$results = @(
    foreach ($process in $processes) {
        $name = [string]$process.Name
        $title = ''
        try {
            $liveProcess = Get-Process -Id ([int]$process.ProcessId) -ErrorAction Stop
            $title = [string]$liveProcess.MainWindowTitle
        } catch {
            # Process may have exited or its window may be inaccessible.
        }

        $isJava = $name -match '^(java|javaw)\.exe$'
        $looksLikeCheatBreaker = ($name -match 'cheat.?breaker') -or ($title -match 'cheat.?breaker')
        if (-not ($isJava -or $looksLikeCheatBreaker)) {
            continue
        }

        [pscustomobject]@{
            ProcessId       = [int]$process.ProcessId
            ParentProcessId = [int]$process.ParentProcessId
            Name            = $name
            WindowTitle     = $title
            ExecutablePath  = [string]$process.ExecutablePath
            VersionStatus   = 'UNKNOWN'
            VersionEvidence = 'No runtime version attestation is collected by this read-only inventory.'
        }
    }
)

if ($results.Count -eq 0) {
    Write-Output 'No Java or clearly named CheatBreaker process was found.'
    exit 0
}

$results | Sort-Object ProcessId | ConvertTo-Json -Depth 3
