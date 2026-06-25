param(
    [ValidateSet("deterministic", "ollama", "bridge", "bridge-mock")]
    [string]$AiMode = "deterministic",
    [string]$CaseId = "case-003",
    [string]$SessionId = "",
    [string]$ParticipantId = "person-001",
    [string]$WorkspaceId = "",
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173,
    [int]$BridgePort = 8080,
    [string]$OllamaModel = "llama3.1:8b",
    [string]$BridgeModel = "interrogaition-bridge-mock",
    [string]$BridgeBaseUrl = "",
    [string]$BridgeApiKey = "",
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$RuntimeDir = Join-Path $RepoRoot ".codex\runtime"
$BackendDir = Join-Path $RepoRoot "backend"
$FrontendDir = Join-Path $RepoRoot "frontend\app"
$BackendPath = Join-Path $RepoRoot "backend"
New-Item -ItemType Directory -Force $RuntimeDir | Out-Null

if (-not $SessionId) {
    $SessionId = "$CaseId-session-dev"
}
if (-not $WorkspaceId) {
    $WorkspaceId = "$CaseId-workspace-dev"
}
if (-not $BridgeBaseUrl) {
    $BridgeBaseUrl = "http://127.0.0.1:$BridgePort/v1"
}

function Quote-PSValue([string]$Value) {
    return "'" + ($Value -replace "'", "''") + "'"
}

function Stop-Listener([int]$Port) {
    if ($NoRestart) {
        return
    }

    $processIds = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        if ($processId -and $processId -ne 0) {
            Write-Output "Stopping existing listener on port $Port (pid $processId)."
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Start-HiddenProcess(
    [string]$Name,
    [string]$WorkingDirectory,
    [string]$Command,
    [string]$OutLog,
    [string]$ErrLog
) {
    Start-Process `
        -FilePath "powershell" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $Command) `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $OutLog `
        -RedirectStandardError $ErrLog | Out-Null
    Write-Output "Started $Name. Logs: $OutLog / $ErrLog"
}

function Wait-Http([string]$Url, [int]$Seconds = 20) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    return $false
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    throw "Python is not available in PATH."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm is not available in PATH."
}

Stop-Listener -Port $BackendPort
Stop-Listener -Port $FrontendPort
if ($AiMode -eq "bridge-mock") {
    Stop-Listener -Port $BridgePort
}

$Provider = "deterministic"
$BackendEnv = @{}

if ($AiMode -eq "ollama") {
    $Provider = "ollama"
    $BackendEnv["INTERROGAITION_OLLAMA_MODEL"] = $OllamaModel
    if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
        Write-Warning "Ollama is not available in PATH. Install/start Ollama before using real local output."
    } elseif (-not (Wait-Http -Url "http://127.0.0.1:11434/api/tags" -Seconds 2)) {
        Start-HiddenProcess `
            -Name "ollama" `
            -WorkingDirectory $RepoRoot `
            -Command "ollama serve" `
            -OutLog (Join-Path $RuntimeDir "ollama.out.log") `
            -ErrLog (Join-Path $RuntimeDir "ollama.err.log")
    }
}

if ($AiMode -in @("bridge", "bridge-mock")) {
    $Provider = "bridge"
    $BackendEnv["INTERROGAITION_BRIDGE_BASE_URL"] = $BridgeBaseUrl
    $BackendEnv["INTERROGAITION_BRIDGE_MODEL"] = $BridgeModel
    if ($BridgeApiKey) {
        $BackendEnv["INTERROGAITION_BRIDGE_API_KEY"] = $BridgeApiKey
    }
}

if ($AiMode -eq "bridge-mock") {
    $MockCommandParts = @()
    $MockCommandParts += '$env:PYTHONPATH = ' + (Quote-PSValue $BackendPath)
    $MockCommandParts += 'python -m interrogaition.ai.mock_bridge_server --host 127.0.0.1 --port ' + $BridgePort + ' --model ' + (Quote-PSValue $BridgeModel)
    $MockCommand = $MockCommandParts -join "; "
    Start-HiddenProcess `
        -Name "bridge mock" `
        -WorkingDirectory $RepoRoot `
        -Command $MockCommand `
        -OutLog (Join-Path $RuntimeDir "bridge-mock.out.log") `
        -ErrLog (Join-Path $RuntimeDir "bridge-mock.err.log")
}

if ($Provider -ne "deterministic") {
    $BackendEnv["INTERROGAITION_MODEL_PROVIDER"] = $Provider
    $BackendEnv["INTERROGAITION_ENABLE_REAL_MODEL"] = "1"
    $BackendEnv["INTERROGAITION_ENABLE_LIVE_MODEL_OUTPUT"] = "1"
}

$BackendCommandParts = @('$env:PYTHONPATH = ' + (Quote-PSValue $BackendPath))
foreach ($entry in $BackendEnv.GetEnumerator()) {
    $BackendCommandParts += '$env:' + $entry.Key + ' = ' + (Quote-PSValue ([string]$entry.Value))
}
$BackendCommandParts += "python -m interrogaition.api.app --host 127.0.0.1 --port $BackendPort"

Start-HiddenProcess `
    -Name "backend" `
    -WorkingDirectory $BackendDir `
    -Command ($BackendCommandParts -join "; ") `
    -OutLog (Join-Path $RuntimeDir "backend.out.log") `
    -ErrLog (Join-Path $RuntimeDir "backend.err.log")

Start-HiddenProcess `
    -Name "frontend" `
    -WorkingDirectory $FrontendDir `
    -Command "npm run dev -- --host 127.0.0.1 --port $FrontendPort" `
    -OutLog (Join-Path $RuntimeDir "frontend.out.log") `
    -ErrLog (Join-Path $RuntimeDir "frontend.err.log")

$BackendReady = Wait-Http -Url "http://127.0.0.1:$BackendPort/health" -Seconds 25
$FrontendReady = Wait-Http -Url "http://127.0.0.1:$FrontendPort/" -Seconds 25
$BridgeReady = $true
if ($AiMode -eq "bridge-mock") {
    $BridgeReady = Wait-Http -Url "http://127.0.0.1:$BridgePort/health" -Seconds 10
}

$ApiUrl = "http://127.0.0.1:$BackendPort"
$EncodedApi = [uri]::EscapeDataString($ApiUrl)
$AppUrl = "http://127.0.0.1:$FrontendPort/?api=$EncodedApi&case=$CaseId&session=$SessionId&participant=$ParticipantId&workspace=$WorkspaceId"

Write-Output ""
Write-Output "Runtime status:"
Write-Output "  backend:  $BackendReady  http://127.0.0.1:$BackendPort"
Write-Output "  frontend: $FrontendReady http://127.0.0.1:$FrontendPort"
if ($AiMode -eq "bridge-mock") {
    Write-Output "  bridge:   $BridgeReady  http://127.0.0.1:$BridgePort/v1"
}
Write-Output "  ai mode:  $AiMode"
Write-Output ""
Write-Output "Open:"
Write-Output "  $AppUrl"
Write-Output ""
Write-Output "Check AI runtime:"
Write-Output "  .\scripts\check-ai-runtime.ps1 -BackendBaseUrl $ApiUrl"
