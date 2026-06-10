# Create a commit without Cursor co-author trailers.
# Requires: .\.git\hooks installed via .\scripts\install-git-hooks.ps1

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Test-Path ".git\hooks\commit-msg")) {
    & (Join-Path $PSScriptRoot "install-git-hooks.ps1")
}

$message = @"
Add export integrity bundle and grounded AI workflow polish.

Expose ZIP session exports with manifest verification, JSON report export,
grounding pack preview and diff, per-question AI cache, and git hooks that
strip Cursor co-author trailers from every commit.
"@

$messagePath = Join-Path $env:TEMP "interrogaition-commit-clean.txt"
[System.IO.File]::WriteAllText($messagePath, $message)

git commit -F $messagePath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Commit message:"
git log -1 --format=full
if (git log -1 --format=%B | Select-String -Pattern "Co-authored-by: Cursor" -Quiet) {
    Write-Error "Cursor co-author trailer detected. Aborting push."
    exit 1
}

git push origin main
