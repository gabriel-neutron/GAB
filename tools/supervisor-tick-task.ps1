# Adds or changes the per-user task of the supervisor tick: one tick each 5 minutes and one at logon.
# It needs no password, so it runs only while the user is signed in. The script is in this checkout.
param(
  [Parameter(Mandatory)][string]$StateDir,
  [string]$TaskName = 'GabrielSupervisorTick'
)
$ErrorActionPreference = 'Stop'

# conhost with no window: a window each 5 minutes stops the operator.
$action = New-ScheduledTaskAction -Execute 'conhost.exe' -Argument (
  "--headless `"$PSHOME\powershell.exe`" -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\supervisor-tick.ps1`" -StateDir `"$StateDir`"")
$triggers = @(
  (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)),
  (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME)
)
# Priority 4 is normal. The default 7 also lowers the memory priority, and with little free memory a
# tick then does not end in its 4 minutes.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -Priority 4
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive
Register-ScheduledTask -TaskName $TaskName -Force -Action $action -Trigger $triggers `
  -Settings $settings -Principal $principal | Out-Null
