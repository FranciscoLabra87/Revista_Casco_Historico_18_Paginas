$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverFile = Join-Path $appRoot "servidor-local.mjs"
$healthRevision = "casco-studio-12-2026-08-20"

function Test-CascoServer([int]$Port) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/__casco_health" -UseBasicParsing -TimeoutSec 1
        $health = $response.Content | ConvertFrom-Json
        return $response.StatusCode -eq 200 `
            -and $health.status -eq "CASCO_STUDIO_OK" `
            -and $health.revision -eq $healthRevision `
            -and $health.root -eq $appRoot
    } catch {
        return $false
    }
}

function Test-PortOccupied([int]$Port) {
    try {
        $connection = [System.Net.Sockets.TcpClient]::new()
        $connectTask = $connection.ConnectAsync("127.0.0.1", $Port)
        $connected = $connectTask.Wait(180) -and $connection.Connected
        $connection.Dispose()
        return $connected
    } catch {
        return $false
    }
}

try {
    $node = Get-Command node.exe -ErrorAction Stop
} catch {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "No se encontró Node.js. La revista se abrirá en modo básico; para usar varias ediciones instale Node.js o solicite el instalador de escritorio.",
        "Taller editorial Casco Histórico"
    ) | Out-Null
    Start-Process (Join-Path $appRoot "index.html")
    exit
}

$selectedPort = 8787
if (-not (Test-CascoServer $selectedPort)) {
    if (Test-PortOccupied $selectedPort) {
        Add-Type -AssemblyName PresentationFramework
        [System.Windows.MessageBox]::Show(
            "El puerto local 8787 está siendo usado por otro programa o por una copia anterior del taller. Cierre esa copia (o reinicie el equipo) y vuelva a abrir la revista; así se evita mezclar instalaciones y almacenamiento editorial.",
            "Taller editorial Casco Histórico"
        ) | Out-Null
        exit 1
    }
    Start-Process -FilePath $node.Source -ArgumentList @("`"$serverFile`"", "$selectedPort") -WorkingDirectory $appRoot -WindowStyle Hidden
    foreach ($attempt in 1..12) {
        Start-Sleep -Milliseconds 150
        if (Test-CascoServer $selectedPort) {
            break
        }
    }
}

if (-not (Test-CascoServer $selectedPort)) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
        "No fue posible iniciar el servidor local. Reinicie el equipo o solicite apoyo técnico antes de continuar.",
        "Taller editorial Casco Histórico"
    ) | Out-Null
    exit 1
}

# El taller se abre como ventana de aplicacion: sin barra de direcciones, sin
# pestanas y con su propio icono en la barra de tareas.
#
# El navegador guarda las revistas por perfil, no por equipo. Abrir otro
# navegador, u otro perfil del mismo navegador, muestra Mis revistas vacio
# aunque las ediciones sigan intactas. Por eso el lanzador busca primero donde
# estan realmente guardadas y abre ahi.
$appUrl = "http://127.0.0.1:$selectedPort/"

function Get-RutaExistente([string[]]$Rutas) {
    return $Rutas | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

$chromeExe = Get-RutaExistente @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
)

$edgeExe = Get-RutaExistente @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
)

# Busca el perfil de navegador que ya contiene ediciones del taller.
function Find-PerfilConEdiciones {
    $encontrados = @()
    $navegadores = @(
        @{ Exe = $chromeExe; Raiz = "$env:LocalAppData\Google\Chrome\User Data" },
        @{ Exe = $edgeExe;   Raiz = "$env:LocalAppData\Microsoft\Edge\User Data" }
    )
    foreach ($nav in $navegadores) {
        if (-not $nav.Exe -or -not (Test-Path $nav.Raiz)) { continue }
        foreach ($perfil in (Get-ChildItem $nav.Raiz -Directory -ErrorAction SilentlyContinue)) {
            $baseDatos = Join-Path $perfil.FullName "IndexedDB"
            if (-not (Test-Path $baseDatos)) { continue }
            $taller = Get-ChildItem $baseDatos -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like "*127.0.0.1_$selectedPort*" }
            if ($taller) {
                $encontrados += [pscustomobject]@{
                    Exe    = $nav.Exe
                    Perfil = $perfil.Name
                    Fecha  = ($taller | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
                }
            }
        }
    }
    return $encontrados | Sort-Object Fecha -Descending | Select-Object -First 1
}

$destino = Find-PerfilConEdiciones

if (-not $destino) {
    # Primera vez: no hay ediciones todavia. Se usa el navegador predeterminado.
    try {
        $clave = "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"
        $progId = (Get-ItemProperty -Path $clave -ErrorAction Stop).ProgId
    } catch {
        $progId = ""
    }
    $exe = if ($progId -like "*Edge*" -and $edgeExe) { $edgeExe } elseif ($chromeExe) { $chromeExe } else { $edgeExe }
    if ($exe) { $destino = [pscustomobject]@{ Exe = $exe; Perfil = "Default" } }
}

if ($destino) {
    Start-Process -FilePath $destino.Exe -ArgumentList @(
        "--app=$appUrl",
        "--profile-directory=`"$($destino.Perfil)`"",
        "--window-size=1280,920"
    )
} else {
    Start-Process $appUrl
}
