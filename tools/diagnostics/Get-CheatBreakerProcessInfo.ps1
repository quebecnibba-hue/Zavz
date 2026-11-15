# Get-CheatBreakerProcessInfo.ps1
# Read-only process inventory. This script does not open process memory,
# inject code, load modules, or change the target process.

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

try {
    $processes = @(Get-CimInstance -ClassName Win32_Process)
} catch {
    Write-Error ("Unable to enumerate process metadata: " + $_.Exception.Message)
    exit 2
}

# Build a local PID lookup so parent process names can be reported without
# querying command lines or opening process handles.
$byPid = @{}
foreach ($item in $processes) {
    $byPid[[int]$item.ProcessId] = $item
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

        $parentName = ''
        $parentId = [int]$process.ParentProcessId
        if ($byPid.ContainsKey($parentId)) {
            $parentName = [string]$byPid[$parentId].Name
        }

        $reason = if ($looksLikeCheatBreaker) {
            'Process name or window title contains CheatBreaker.'
        } else {
            'Java process candidate; parent metadata is contextual only.'
        }

        [pscustomobject]@{
            ProcessId       = [int]$process.ProcessId
            ParentProcessId = $parentId
            ParentName      = $parentName
            Name            = $name
            WindowTitle     = $title
            ExecutablePath  = [string]$process.ExecutablePath
            CandidateReason = $reason
            VersionStatus   = 'UNKNOWN'
            VersionEvidence = 'Process metadata does not attest the Minecraft runtime version.'
        }
    }
)

if ($results.Count -eq 0) {
    Write-Output 'No Java or clearly named CheatBreaker process was found.'
    exit 0
}

$results | Sort-Object ProcessId | ConvertTo-Json -Depth 3
