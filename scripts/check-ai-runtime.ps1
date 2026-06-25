param(
    [string]$BackendBaseUrl = "http://127.0.0.1:8000",
    [string]$BridgeApiKey = ""
)

$ErrorActionPreference = "Stop"

function Read-Json([string]$Url) {
    Invoke-RestMethod -Uri $Url -TimeoutSec 5
}

Write-Host "Checking backend: $BackendBaseUrl"
$health = Read-Json "$BackendBaseUrl/health"
Write-Host "  health: $($health.status)"

$config = Read-Json "$BackendBaseUrl/ai/local-model/config"
Write-Host "  provider:           $($config.provider)"
Write-Host "  effective provider: $($config.effective_provider)"
Write-Host "  model:              $($config.configured_model)"
Write-Host "  real enabled:       $($config.real_model_enabled)"
Write-Host "  live enabled:       $($config.live_output_enabled)"

if ($config.provider -eq "ollama") {
    if (Get-Command ollama -ErrorAction SilentlyContinue) {
        Write-Host "  ollama binary:      available"
    } else {
        Write-Warning "  ollama binary:      missing from PATH"
    }
}

if ($config.provider -eq "bridge") {
    Write-Host "  bridge base URL:    $($config.bridge_base_url)"
    Write-Host "  bridge API key:     configured=$($config.bridge_api_key_configured)"
}

Write-Host ""
Write-Host "Safe backend smoke:"
$smoke = Invoke-RestMethod -Method Post -Uri "$BackendBaseUrl/ai/local-model/smoke" -TimeoutSec 10
Write-Host "  ok:                 $($smoke.ok)"
Write-Host "  provider:           $($smoke.provider)"
Write-Host "  model:              $($smoke.model)"
Write-Host "  real invoked:       $($smoke.real_model_invoked)"

if ($config.provider -eq "bridge") {
    Write-Host ""
    Write-Host "Bridge HTTP smoke:"
    $bridgeHeaders = @{ "Content-Type" = "application/json" }
    if ($BridgeApiKey) {
        $bridgeHeaders["Authorization"] = "Bearer $BridgeApiKey"
    }
    $bridgeBody = @{
        model = $config.configured_model
        messages = @(
            @{ role = "system"; content = "Return compact JSON." },
            @{ role = "user"; content = '{"status":"ping"}' }
        )
        response_format = @{ type = "json_object" }
        temperature = 0.0
    } | ConvertTo-Json -Depth 6
    try {
        $bridgeResponse = Invoke-RestMethod `
            -Method Post `
            -Uri "$($config.bridge_base_url.TrimEnd('/'))/chat/completions" `
            -Headers $bridgeHeaders `
            -Body $bridgeBody `
            -TimeoutSec 10
        Write-Host "  ok:                 True"
        Write-Host "  model:              $($bridgeResponse.model)"
        Write-Host "  content preview:    $($bridgeResponse.choices[0].message.content.Substring(0, [Math]::Min(80, $bridgeResponse.choices[0].message.content.Length)))"
    } catch {
        Write-Warning "  bridge HTTP smoke failed: $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Restrictions:"
foreach ($restriction in $config.restrictions) {
    Write-Host "  - $restriction"
}
