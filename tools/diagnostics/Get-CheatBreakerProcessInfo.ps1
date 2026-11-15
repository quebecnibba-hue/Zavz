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

# Build a local PID lookup so ancestry can be described from the same
# read-only snapshot without querying command lines or opening process handles.
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

        $parentId = [int]$process.ParentProcessId
        $parentName = ''
        if ($byPid.ContainsKey($parentId)) {
            $parentName = [string]$byPid[$parentId].Name
        }

        $ancestorNames = @()
        $visited = @{}
        $cursor = $parentId
        for ($depth = 0; $depth -lt 5 -and $cursor -gt 0; $depth++) {
            if ($visited.ContainsKey($cursor) -or -not $byPid.ContainsKey($cursor)) {
                break
            }
            $visited[$cursor] = $true
            $ancestor = $byPid[$cursor]
            $ancestorNames += [string]$ancestor.Name
            $cursor = [int]$ancestor.ParentProcessId
        }

        $reason = if ($looksLikeCheatBreaker) {
            'Process name or window title contains CheatBreaker.'
        } else {
            'Java process candidate; process ancestry is contextual only.'
        }

        [pscustomobject]@{
            ProcessId       = [int]$process.ProcessId
            ParentProcessId = $parentId
            ParentName      = $parentName
            AncestorNames   = ($ancestorNames -join ' <- ')
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
