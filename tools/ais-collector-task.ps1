# Adds or changes the per-user task of the AIS collector: one pull each hour and one at logon. It
# needs no password, so it runs only while the user is signed in. The repository is this checkout.
param(
  [Parameter(Mandatory)][string]$Folder,
  [Parameter(Mandatory)][string]$EnvFile
)
$ErrorActionPreference = 'Stop'

$repository = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node).Source
# conhost with no window: node has no windowless build, and a window each hour stops the operator.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -WorkingDirectory $repository -Argument (
  "--headless `"$node`" --env-file=`"$EnvFile`" tools/ais-collector.ts pull `"$Folder`"")
$triggers = @(
  (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)),
  (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME)
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName 'GabrielAisCollector' -Force -Action $action -Trigger $triggers `
  -Settings $settings -Principal $principal | Out-Null
