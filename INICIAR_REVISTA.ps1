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

Start-Process "http://127.0.0.1:$selectedPort/"
