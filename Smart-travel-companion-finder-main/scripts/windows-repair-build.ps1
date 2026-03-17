$projectRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$candidateDirs = @(
  (Join-Path $projectRoot 'node_modules\@esbuild'),
  (Join-Path $projectRoot 'node_modules\esbuild'),
  (Join-Path $projectRoot 'node_modules\vite'),
  (Join-Path $projectRoot 'node_modules\@rollup')
)

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
  Write-Error 'node_modules is missing. Run npm install first.'
  exit 1
}

$visited = 0

foreach ($dir in $candidateDirs) {
  if (-not (Test-Path $dir)) {
    continue
  }

  Get-ChildItem -Path $dir -Recurse -File | ForEach-Object {
    try {
      Unblock-File -Path $_.FullName -ErrorAction Stop
      $visited++
    } catch {
      # Ignore files without a Zone.Identifier stream.
    }
  }
}

Write-Host "Windows build repair finished. Checked $visited file(s)."
Write-Host 'Run npm run doctor:windows-build, then retry npm run build.'
