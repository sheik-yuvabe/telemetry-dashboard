[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory=$true)][string]$AccountId,
    [switch]$NoStart
)
$ErrorActionPreference = 'Stop'
$nodePath = (Get-Command node -ErrorAction Stop).Source
$codexDir = Join-Path $env:USERPROFILE '.codex'
$mentorConfig = Join-Path $codexDir 'telemetry_config.json'
if (-not (Test-Path -LiteralPath $mentorConfig)) { throw 'Install the mentor-managed telemetry_config.json first.' }
$mentor = Get-Content -LiteralPath $mentorConfig -Raw | ConvertFrom-Json
if ($mentor.reporting_enabled -ne $true) { throw 'Student reporting is disabled.' }
$installDir = Join-Path $codexDir 'usage-collector'
$configPath = Join-Path $installDir 'config.json'
$taskName = 'Yuvabe-Usage-Collector'
if ($PSCmdlet.ShouldProcess($installDir, 'Install token collector and register a per-user scheduled task')) {
    if (Test-Path -LiteralPath $configPath) {
        $existing = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if ($existing.account_id -ne $AccountId) { throw 'Account differs from existing enrollment. Preserve pending state before changing enrollment.' }
        $startedAt = $existing.started_at
    } else { $startedAt = [DateTime]::UtcNow.ToString('o') }
    # Authenticate and register/verify the student BEFORE changing local files or tasks.
    & $nodePath (Join-Path $PSScriptRoot 'enroll.js') --config $mentorConfig --account-id $AccountId
    if ($LASTEXITCODE -ne 0) { throw 'Enrollment failed. Collector installation was not changed. Fix the configuration and retry.' }
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($existingTask) {
        Disable-ScheduledTask -TaskName $taskName | Out-Null
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    }
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    foreach ($name in @('collector.js','enroll.js','run.ps1','launch-hidden.vbs')) {
        $source = Join-Path $PSScriptRoot $name
        $target = Join-Path $installDir $name
        if ([IO.Path]::GetFullPath($source) -ne [IO.Path]::GetFullPath($target)) { Copy-Item -LiteralPath $source -Destination $target -Force }
    }
    $config = @{ enabled=$true; telemetry_config=$mentorConfig; account_id=$AccountId; started_at=$startedAt; discovery='auto' }
    $config | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $configPath -Encoding UTF8
    & $nodePath (Join-Path $installDir 'collector.js') --config $configPath --dry-run
    if ($LASTEXITCODE -ne 0) { throw 'Collector validation failed. Scheduled task was not installed.' }
    $launcher = Join-Path $installDir 'launch-hidden.vbs'
    $launcherArgs = '//B //NoLogo "' + $launcher + '" "' + $nodePath + '"'
    $action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\wscript.exe') -Argument $launcherArgs
    $userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $userId
    $repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 1)
    $principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($logon,$repeat) -Principal $principal -Settings $settings -Description 'Upload measured primary Codex VS Code usage for enrolled Yuvabe project folders.' -Force | Out-Null
    if ($NoStart) { Disable-ScheduledTask -TaskName $taskName | Out-Null }
    else { Start-ScheduledTask -TaskName $taskName }
    Write-Output "Installed in $installDir. Task: $taskName."
    Write-Output 'Primary-session coverage only. Check --status and last-run.log before trusting live collection.'
}
