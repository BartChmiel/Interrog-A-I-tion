$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $PSScriptRoot "git-hooks"
$targetDir = Join-Path $repoRoot ".git\hooks"

if (-not (Test-Path $targetDir)) {
    throw "Git hooks directory not found: $targetDir"
}

Get-ChildItem -Path $sourceDir -File | ForEach-Object {
    $target = Join-Path $targetDir $_.Name
    Copy-Item -Path $_.FullName -Destination $target -Force
    Write-Host "Installed $($_.Name)"
}

Write-Host "Git hooks installed. Cursor co-author trailers will be stripped automatically."
