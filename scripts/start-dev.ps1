<#
Starts the LeadOps stack on Windows with the repo's own Python (backend\.venv), so it never
matters which Python is first on PATH. The first run creates backend\.venv and installs the
Python (backend\) and npm (frontend\) dependencies; later runs just start the services, each
in its own PowerShell window.

    .\scripts\start-dev.ps1                  ingest API, gateway and UI (+ the MongoDB relay if needed)
    .\scripts\start-dev.ps1 -StubDatabase    same, but the ingest API writes to bench_outreach_stub
    .\scripts\start-dev.ps1 -Relay           always start the relay, even if MongoDB answers without it
    .\scripts\start-dev.ps1 -Setup           (re)install dependencies only, start nothing

The MongoDB relay (backend\scripts\wsl_mongo_relay.py) is started only when Windows cannot reach the
WSL mongod on 127.0.0.1:27017 by itself -- that is, when WSL's localhost forwarding has dropped.
With WSL mirrored networking, or while forwarding works, no relay window opens.

If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
#>
param([switch]$Setup, [switch]$StubDatabase, [switch]$Relay)
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root 'backend'
$Frontend = Join-Path $Root 'frontend'
$Venv = Join-Path $Backend '.venv'
$Python = Join-Path $Venv 'Scripts\python.exe'

if (-not (Test-Path $Python)) {
    Write-Host 'Creating backend\.venv (the repo''s own Python environment)...'
    if (Get-Command py -ErrorAction SilentlyContinue) { py -3 -m venv $Venv }
    else { python -m venv $Venv }
    $Setup = $true
}
if ($Setup) {
    Write-Host 'Installing Python dependencies into backend\.venv...'
    & $Python -m pip install --upgrade pip
    & $Python -m pip install $Backend
    Write-Host 'Installing npm dependencies in frontend\...'
    Push-Location $Frontend; npm install; Pop-Location
    if ($PSBoundParameters.ContainsKey('Setup')) { Write-Host 'Setup done.'; exit 0 }
}

# A server left running from an earlier start keeps its port and makes the new one fail
# ("only one usage of each socket address"), so stop this app's leftovers first.
foreach ($Port in 8000, 4100, 3000) {
    Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
            $Process = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if (-not $Process) { return }
            if ($Process.ProcessName -notin 'python', 'pythonw', 'uvicorn', 'node') {
                throw "Port $Port is used by $($Process.ProcessName) (PID $($Process.Id)); close it and run this again."
            }
            Write-Host "Stopping leftover $($Process.ProcessName) (PID $($Process.Id)) on port $Port"
            Stop-Process -Id $Process.Id -Force
        }
}
# Port 27017: stop only an earlier relay of ours (python). Anything else there -- WSL's own
# forwarding (wslrelay) or mirrored networking -- is how Windows reaches mongod; leave it.
Get-NetTCPConnection -LocalPort 27017 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {
        $Process = Get-Process -Id $_ -ErrorAction SilentlyContinue
        if ($Process -and $Process.ProcessName -in 'python', 'pythonw') {
            Write-Host "Stopping leftover MongoDB relay (PID $($Process.Id))"
            Stop-Process -Id $Process.Id -Force
        }
    }
Start-Sleep -Seconds 1

# True when a MongoDB server answers a ping on 127.0.0.1:27017 within 2 seconds. A real ping,
# not a port check: broken forwarding can still accept the connection and then say nothing.
function Test-MongoReachable {
    $ping = "from pymongo import MongoClient; MongoClient('mongodb://127.0.0.1:27017/?directConnection=true', serverSelectionTimeoutMS=2000).admin.command('ping')"
    & $Python -c $ping 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

# One window per service; every Python service runs on backend\.venv's python.
function Open-ServiceWindow([string]$Title, [string]$Folder, [string]$Command) {
    $script = "`$Host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$Folder'; $Command"
    Start-Process powershell -ArgumentList '-NoExit', '-Command', $script
}

$Windows = 3
if (-not $Relay -and (Test-MongoReachable)) {
    Write-Host 'MongoDB answers on 127.0.0.1:27017 without the relay (WSL forwarding or mirrored networking): no relay window.'
} else {
    Write-Host 'Starting the MongoDB relay (Windows 127.0.0.1:27017 -> WSL mongod)...'
    Open-ServiceWindow 'mongo relay' $Backend "& '$Python' scripts\wsl_mongo_relay.py"
    $Windows = 4
    Start-Sleep -Seconds 3
    if (-not (Test-MongoReachable)) {
        Write-Warning 'MongoDB still does not answer on 127.0.0.1:27017. Is mongod running in WSL? Try: wsl -e systemctl status mongod'
    }
}

$Database = if ($StubDatabase) { "`$env:MONGODB_DB = 'bench_outreach_stub'; " } else { '' }
Open-ServiceWindow 'ingest API :8000' (Join-Path $Backend 'integrations') `
    "$Database`$env:LOG_CONSOLE = 'rendered'; & '$Python' -m uvicorn main:app --port 8000"
Open-ServiceWindow 'gateway :4100' (Join-Path $Backend 'gateway') `
    "& '$Python' -m uvicorn main:app --port 4100 --timeout-graceful-shutdown 2"
Open-ServiceWindow 'UI :3000' $Frontend 'npm run dev'

Write-Host "Started. Open http://127.0.0.1:3000/upload  (close the $Windows windows to stop)."
