$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$SSID = 'GALILEO'
$CLAVE = 'galileo1610'

function Log($m) { "$(Get-Date -Format 'dd/MM HH:mm:ss')  $m" | Add-Content (Join-Path $raiz 'registro.txt') }

$PID | Set-Content (Join-Path $raiz 'guardian.pid')

# Evita que Windows suspenda la PC o apague la pantalla mientras este proceso viva.
Add-Type -Namespace Win -Name Energia -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint f);'
[Win.Energia]::SetThreadExecutionState([uint32]'0x80000003') | Out-Null

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]
function Esperar($op, $tipo) { $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$asTaskAccion = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
} | Select-Object -First 1
function EsperarAccion($op) { $asTaskAccion.Invoke($null, @($op)).Wait(-1) | Out-Null }

$NetInfo = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
$Tether = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]
$TipoRes = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringOperationResult, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]

function Hotspot {
  $perfil = $NetInfo::GetInternetConnectionProfile()
  $tm = $null
  if ($perfil) { $tm = $Tether::CreateFromConnectionProfile($perfil) }
  if (-not $tm) {
    # Sin internet: se intenta con cualquier otra conexión activa (Wi-Fi sin internet o cable).
    foreach ($p in $NetInfo::GetConnectionProfiles()) {
      if ([int]$p.GetNetworkConnectivityLevel() -ge 1) {
        try { $tm = $Tether::CreateFromConnectionProfile($p); if ($tm) { break } } catch {}
      }
    }
  }
  if (-not $tm) { Log 'Sin conexion: Windows no permite encender el hotspot (conecta la PC a un Wi-Fi o cable)'; return }
  $c = $tm.GetCurrentAccessPointConfiguration()
  if ($c.Ssid -ne $SSID -or $c.Passphrase -ne $CLAVE) {
    $c.Ssid = $SSID
    $c.Passphrase = $CLAVE
    EsperarAccion ($tm.ConfigureAccessPointAsync($c))
    Log "Hotspot configurado como $SSID"
  }
  if ($tm.TetheringOperationalState -ne 'On') {
    $r = Esperar ($tm.StartTetheringAsync()) $TipoRes
    Log "Encendiendo hotspot: $($r.Status) $($r.AdditionalErrorMessage)"
  }
}

$node = $null
function Servidor {
  if (-not $script:node -or $script:node.HasExited) {
    $script:node = Start-Process node -ArgumentList 'server.js' -WorkingDirectory $raiz -WindowStyle Hidden -PassThru
    $script:node.Id | Set-Content (Join-Path $raiz 'servidor.pid')
    Log "Servidor iniciado (PID $($script:node.Id))"
  }
}

Log 'Guardian iniciado'
while ($true) {
  try { Hotspot } catch { Log "Error hotspot: $($_.Exception.Message)" }
  try { Servidor } catch { Log "Error servidor: $($_.Exception.Message)" }
  Start-Sleep -Seconds 15
}
