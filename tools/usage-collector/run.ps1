param([Parameter(Mandatory=$true)][string]$NodePath)
$ErrorActionPreference = 'Stop'
$logPath = Join-Path $PSScriptRoot 'last-run.log'
try {
    # Overwrite the latest run log so background output cannot grow without bound.
    $start = New-Object System.Diagnostics.ProcessStartInfo
    $start.FileName = $NodePath
    $start.Arguments = '"' + (Join-Path $PSScriptRoot 'collector.js') + '" --config "' + (Join-Path $PSScriptRoot 'config.json') + '"'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $start
    if (-not $process.Start()) { throw 'Could not start collector.' }
    # Drain both pipes concurrently to avoid blocking on a full error/output buffer.
    $outputTask = $process.StandardOutput.ReadToEndAsync()
    $errorTask = $process.StandardError.ReadToEndAsync()
    $process.WaitForExit()
    ($outputTask.Result + $errorTask.Result) | Set-Content -LiteralPath $logPath -Encoding UTF8
    $result = $process.ExitCode
    $process.Dispose()
    exit $result
} catch {
    'Collector failed to start. Check Node installation, config and file access.' | Set-Content -LiteralPath $logPath
    exit 1
}
