$ErrorActionPreference = "Stop"
$appRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverFile = Join-Path $appRoot "servidor-local.mjs"

function Test-CascoServer([int]$Port) {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/__casco_health" -UseBasicParsing -TimeoutSec 1
        return $response.StatusCode -eq 200 -and $response.Content -eq "CASCO_STUDIO_OK"
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
            "El puerto local 8787 está siendo usado por otro programa. Ciérrelo y vuelva a abrir la revista; así se conserva siempre el mismo almacenamiento editorial.",
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
# Se usa el navegador predeterminado del equipo y su perfil habitual. Es
# deliberado: el navegador guarda las revistas por perfil, asi que cambiar de
# navegador o abrir un perfil aparte dejaria las ediciones anteriores fuera de
# la vista. Si no hay un navegador compatible con el modo aplicacion, se abre
# de la forma corriente.
$appUrl = "http://127.0.0.1:$selectedPort/"

function Get-NavegadorPredeterminado {
    try {
        $clave = "HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice"
        return (Get-ItemProperty -Path $clave -ErrorAction Stop).ProgId
    } catch {
        return ""
    }
}

$chrome = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$edge = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

$progId = Get-NavegadorPredeterminado
if ($progId -like "*Edge*") {
    $navegador = if ($edge) { $edge } else { $chrome }
} elseif ($progId -like "*Chrome*") {
    $navegador = if ($chrome) { $chrome } else { $edge }
} else {
    $navegador = $null
}

if ($navegador) {
    Start-Process -FilePath $navegador -ArgumentList @("--app=$appUrl", "--window-size=1280,920")
} else {
    Start-Process $appUrl
}
