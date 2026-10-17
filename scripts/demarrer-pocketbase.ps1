$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pbRoot = Join-Path $projectRoot 'pocketbase'
$runtime = Join-Path $pbRoot 'runtime'
$exe = Join-Path $runtime 'pocketbase.exe'
$version = '0.40.5'
if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') { throw 'Ce lanceur nécessite Windows x64 (AMD64).' }
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
if (!(Test-Path $exe)) {
    $archive = Join-Path $runtime 'pocketbase.zip'
    $checksums = Join-Path $runtime 'checksums.txt'
    $asset = "pocketbase_${version}_windows_amd64.zip"
    $base = "https://github.com/pocketbase/pocketbase/releases/download/v$version"
    Write-Host "Téléchargement de PocketBase $version depuis le dépôt officiel..."
    Invoke-WebRequest "$base/$asset" -OutFile $archive
    Invoke-WebRequest "$base/checksums.txt" -OutFile $checksums
    $line = Get-Content $checksums | Where-Object { $_ -match "\s+\*?$([regex]::Escape($asset))$" } | Select-Object -First 1
    if (!$line) { throw 'Somme de contrôle officielle introuvable.' }
    $expected = ($line -split '\s+')[0]
    $actual = (Get-FileHash $archive -Algorithm SHA256).Hash
    if ($actual -ne $expected) { Remove-Item $archive; throw 'Archive invalide : SHA256 différent.' }
    Expand-Archive -Path $archive -DestinationPath $runtime -Force
    Remove-Item $archive
}
$installedVersion = & $exe --version
if ($installedVersion -notmatch [regex]::Escape($version)) { throw "Version inattendue : $installedVersion. Version requise : $version" }
Write-Host 'Étudia : http://127.0.0.1:8090'
Write-Host 'Administration PocketBase : http://127.0.0.1:8090/_/'
Write-Host 'Gardez cette fenêtre ouverte. Ctrl+C pour arrêter.'
& $exe serve '--http=127.0.0.1:8090' "--dir=$pbRoot/pb_data" "--migrationsDir=$pbRoot/pb_migrations" "--hooksDir=$pbRoot/pb_hooks" "--publicDir=$pbRoot/pb_public" '--automigrate=false'
