@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach ($f in 'guardian.pid','servidor.pid') { if (Test-Path $f) { Stop-Process -Id (Get-Content $f) -Force -ErrorAction SilentlyContinue; Remove-Item $f } }; Add-Type -AssemblyName System.Runtime.WindowsRuntime; $p=[Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile(); if ($p) { $tm=[Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($p); [void]$tm.StopTetheringAsync() }; Start-Sleep 2"
echo Galileo apagado: servidor y hotspot detenidos.
pause
