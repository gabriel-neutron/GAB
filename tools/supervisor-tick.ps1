# One tick of the supervisor. It holds no model, it takes a lock, and it ends, so nothing long-lived
# can die. Task Scheduler starts it (supervisor-tick-task.ps1). Only this script writes the state.
# Each step: read the ended workers, move one ticket, start one worker up to the cap, write the
# status file, send a notification while an alarm is open.
# StateDir holds: supervisor.json (settings), tickets/, inbox/ (requests to the tick), workers/,
# history/, status.json, resume.json, services.json, tick.log and operator-queue.md.
param(
  [Parameter(Mandatory)][string]$StateDir,
  [string]$Now,      # A fixed clock, for a test.
  [string]$RunWorker # Internal: the start of the paths of one worker, in the process that waits for it.
)
$ErrorActionPreference = 'Stop'
$utf8 = New-Object Text.UTF8Encoding($false)

# Windows PowerShell joins an argument list with no quotes.
function Format-Argument([string]$a) { '"' + (($a -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1') + '"' }

function Save-File([string]$path, [string]$text) {
  [IO.File]::WriteAllText("$path.tmp", $text, $utf8)
  if (Test-Path $path) { (Get-Item $path).IsReadOnly = $false }
  Move-Item -Force "$path.tmp" $path
}

if ($RunWorker) {
  # This process stays with the worker, because the tick ends and cannot read an exit code later.
  $spec = [IO.File]::ReadAllText("$RunWorker.spec.json") | ConvertFrom-Json
  foreach ($e in @($spec.env.PSObject.Properties)) { if ($e) { [Environment]::SetEnvironmentVariable($e.Name, "$($e.Value)") } }
  try {
    $code = (Start-Process -FilePath $spec.command -ArgumentList (@($spec.args) | ForEach-Object { Format-Argument $_ }) `
        -WorkingDirectory $spec.workDir -NoNewWindow -Wait -PassThru -RedirectStandardInput "$RunWorker.prompt" `
        -RedirectStandardOutput "$RunWorker.out" -RedirectStandardError "$RunWorker.err").ExitCode
  } catch {
    [IO.File]::WriteAllText("$RunWorker.err", "$_", $utf8)
    $code = 127
  }
  Save-File "$RunWorker.exit" "$code"
  exit 0
}

$FREEZE = [datetime]'2026-11-20' # Method, section 5. The supervisor uses this one value.
$MAX_ATTEMPTS = 3
$STALE_MINUTES = 30
$STUCK_MINUTES = 10 # Over the 4-minute limit of the task: no tick that works is this old.
$NEXT = @{ pilot = 'working'; working = 'reviewing'; reviewing = 'closing'; closing = 'closed' }
$WORK = @('pilot', 'working', 'reviewing', 'closing', 'needs_panel')
# The minutes to the next try of a hold. A try after a hold costs no attempt. A signature has no timer.
$HOLDS = @{ waiting_quota = 1440; waiting_source = 1440; waiting_ceiling = 1440; waiting_token = 30; waiting_limit = 30; waiting_service = 10; waiting_signature = 0 }
$BLOCK_ALL = @('waiting_token', 'waiting_limit', 'waiting_service')
$ALARM_HOLDS = @('waiting_token', 'waiting_ceiling', 'waiting_signature')
$WORKER_HOURS = 12 # The longest run so far took under one hour.
$MAX_HOLD_DAYS = 7 # A worker gives the retry time of a hold, and a false date must not hide the ticket.
$STATES = @('ready', 'reopened', 'parked', 'closed', 'closed_exhausted', 'closed_parked') + $WORK + @($HOLDS.Keys)
# shortcut: these words come from the errors that the CLI shows today, add a word when a new wording appears.
$SIGN_IN = 'OAuth session|session expired|not logged in|please run /login|failed to authenticate|authentication_error|invalid api key|invalid bearer'
$LIMIT = 'usage limit|rate limit|limit reached|out of extra usage'
$SERVICE = 'ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|reach the API server|connection error'
$SERVICE_ALARM_HOLDS = 3 # Three holds of 10 minutes with no worker that ends: a person must see this.
$SERVICE_ALARM_MINUTES = 30 # A repair takes under one minute, and a stop of the engine does not end with one.
$SHORT_RESULT = 300 # A sign-in or limit error is short. A long result is the prose of the worker, and it can hold these words.

$time = if ($Now) { [datetime]$Now } else { Get-Date }
$tickets_dir, $inbox_dir, $workers_dir, $history_dir = 'tickets', 'inbox', 'workers', 'history' | ForEach-Object {
  $d = Join-Path $StateDir $_
  [void][IO.Directory]::CreateDirectory($d)
  $d
}
$queue = Join-Path $StateDir 'operator-queue.md'

function Write-Log([string]$line) { [IO.File]::AppendAllText((Join-Path $StateDir 'tick.log'), "$($time.ToString('s')) $line`r`n", $utf8) }

# The read-only flag stops a stray write of a worker. This function is the one writer of a state file.
function Save-State([string]$path, $value) {
  Save-File $path ($value | ConvertTo-Json -Depth 8)
  (Get-Item $path).IsReadOnly = $true
}
function Save-Ticket($t) { Save-State (Join-Path $tickets_dir "$($t.id).json") $t }

function Complete-Ticket($t) {
  if ($t.id -notmatch '^[A-Za-z0-9_-]+$' -or $STATES -notcontains $t.state) { throw 'bad id or state' }
  if ($t.until) { [void][datetime]$t.until }
  $fields = @{ attempts = 0; noPass = 0; panelCrashes = 0; serviceHolds = 0; runs = 0; gaps = @(); heldFrom = $null; panelFrom = $null; until = $null; worker = $null; outcome = $null; reason = '' }
  foreach ($k in $fields.Keys) {
    if ($t.PSObject.Properties.Name -notcontains $k) { $t | Add-Member -NotePropertyName $k -NotePropertyValue $fields[$k] }
  }
  $t
}

function Test-Running($w) {
  if (Test-Path "$($w.base).exit") { return $false }
  $p = Get-Process -Id $w.pid -ErrorAction SilentlyContinue
  # A process of another account can hold a used pid, and its start time is refused. Start time 0 is not known.
  try { [bool]($p -and ($w.started -eq 0 -or $p.StartTime.Ticks -eq $w.started)) } catch { $false }
}

# A hung worker must not hold its slot for good. True when the worker is over the limit, and then it is stopped.
function Stop-Overdue($w) {
  if (-not $w.startedAt -or $time -lt ([datetime]$w.startedAt).AddHours($WORKER_HOURS)) { return $false }
  # With no start time, the pid can have a new owner, so the tick kills nothing.
  if ($w.started -ne 0) {
    try { & taskkill.exe /T /F /PID $w.pid 2>&1 | Out-Null } catch { Write-Log "taskkill failed: $_" }
  }
  $true
}

function Start-Worker([string]$name, [string]$prompt) {
  $base = Join-Path $workers_dir $name
  Save-File "$base.prompt" $prompt
  Save-File "$base.spec.json" (@{ command = $config.command; args = @($config.args); workDir = $config.workDir; env = $config.env } | ConvertTo-Json -Depth 4)
  $self = "-NoProfile -ExecutionPolicy Bypass -File $(Format-Argument $PSCommandPath) -StateDir $(Format-Argument $StateDir) -RunWorker $(Format-Argument $base)"
  $p = Start-Process -FilePath "$PSHOME\powershell.exe" -ArgumentList $self -WindowStyle Hidden -PassThru
  $started = try { $p.StartTime.Ticks } catch { 0 }
  Write-Log "start $name pid $($p.Id)"
  @{ pid = $p.Id; started = $started; base = $base; startedAt = $time.ToString('o') }
}

# A pass needs exit 0, a result with is_error false, and a verdict line. "subtype success" alone is
# not a pass: a failed sign-in gives it with is_error true (P1 of the plan).
function Read-Outcome([string]$base) {
  if (-not (Test-Path "$base.exit")) { return @{ kind = 'failed'; reason = 'worker lost: no exit code' } }
  $code = [int][IO.File]::ReadAllText("$base.exit")
  $result = $null
  $out = @(if (Test-Path "$base.out") { [IO.File]::ReadAllLines("$base.out") })
  foreach ($line in $out) {
    if ($line -match '"type"\s*:\s*"result"') {
      try { $e = $line | ConvertFrom-Json; if ($e.type -eq 'result') { $result = $e } } catch { Write-Log "bad result line in $base" }
    }
  }
  if ($code -ne 0 -or -not $result -or $result.is_error -isnot [bool] -or $result.is_error) {
    $err = if (Test-Path "$base.err") { [IO.File]::ReadAllText("$base.err") } else { '' }
    $own = if ($result) { "$($result.result)" } else { ($out | Select-Object -Last 5) -join ' ' }
    $text = if ($own.Length -le $SHORT_RESULT) { "$own $err" } else { $err }
    $all = "$own $err"
    $reason = "exit $code, is_error $($result.is_error): " + $all.Substring(0, [Math]::Min(200, $all.Length)).Trim()
    if ($result.api_error_status -eq 401 -or $text -match $SIGN_IN) { return @{ kind = 'token'; reason = $reason } }
    if ($result.api_error_status -eq 429 -or $text -match $LIMIT) { return @{ kind = 'limit'; reason = $reason } }
    if ($text -match $SERVICE) { return @{ kind = 'service'; reason = $reason } }
    return @{ kind = 'failed'; reason = $reason }
  }
  $last = @("$($result.result)" -split "`n" | Where-Object { $_.Trim().StartsWith('{') }) | Select-Object -Last 1
  try { $verdict = $last | ConvertFrom-Json } catch { $verdict = $null }
  # A model can leave a quote with no escape in its reason, after the worker did its work. The other
  # fields come first in the format. A reopen stays a failure here, because it needs its gaps.
  if (-not $verdict -and "$last" -match '^\s*\{\s*"result"\s*:\s*"(pass|close|failed|hold|exhausted|stop_source)"') {
    $verdict = [pscustomobject]@{ result = $Matches[1]; hold = $null; newFacts = $null; reason = 'a verdict line with a bad quote' }
    if ("$last" -match '"hold"\s*:\s*"(\w+)"') { $verdict.hold = $Matches[1] }
    if ("$last" -match '"newFacts"\s*:\s*(\d+)') { $verdict.newFacts = $Matches[1] }
  }
  if (-not $verdict.result) { return @{ kind = 'failed'; reason = 'no verdict line' } }
  $goodDate = $true
  if ($verdict.until) { try { [void][datetime]"$($verdict.until)" } catch { $goodDate = $false } }
  if (-not $goodDate -or ($null -ne $verdict.newFacts -and "$($verdict.newFacts)" -notmatch '^\d+$')) {
    return @{ kind = 'failed'; reason = 'bad value in the verdict line' }
  }
  @{ kind = 'verdict'; verdict = $verdict; reason = "$($verdict.reason)" }
}

function Set-Park($t) {
  [IO.File]::AppendAllText($queue, "- $($t.id) is parked: $($t.reason -replace '\s+', ' ')`r`n", $utf8)
  $t.state = 'parked'
}
function Set-Panel($t) {
  if ($t.state -eq 'needs_panel') { return } # panelFrom keeps the state to return to.
  $t.panelFrom = $t.state
  $t.state = 'needs_panel'
  $t.panelCrashes = 0
}
function Set-Hold($t, [string]$hold, $until) {
  $t.heldFrom = $t.state
  $t.state = $hold
  $latest = $time.AddDays($MAX_HOLD_DAYS)
  # Only an inbox request ends a signature hold, so a date of a worker does not count for it.
  $t.until = if (-not $HOLDS[$hold]) { $null } elseif ($until) { $(if ([datetime]"$until" -gt $latest) { $latest } else { [datetime]"$until" }).ToString('o') }
  else { $time.AddMinutes($HOLDS[$hold]).ToString('o') }
}
# A crash is not a disagreement of the panel, and a ticket here often has no attempt left. Panel verdict on BLD-02.
function Add-PanelCrash($t) {
  $t.panelCrashes++
  if ($t.panelCrashes -ge $MAX_ATTEMPTS) { $t.reason = "the panel worker failed $MAX_ATTEMPTS times: $($t.reason)"; Set-Park $t }
}
function Add-Failure($t) {
  $t.attempts++
  $t.noPass++
  if ($t.attempts -ge $MAX_ATTEMPTS) { Set-Park $t } elseif ($t.noPass -ge 2) { Set-Panel $t }
}

function Move-ByOutcome($t) {
  $o = $t.outcome
  $t.outcome = $null
  $t.reason = "$($o.reason)" -replace '\s+', ' ' # The reason comes from a worker, and a queue line is one line.
  $t.serviceHolds = if ($o.kind -eq 'service' -or "$($o.verdict.hold)" -eq 'waiting_service') { $t.serviceHolds + 1 } else { 0 }
  if ($o.kind -eq 'service') { return Set-Hold $t 'waiting_service' }
  if ($o.kind -eq 'token') { return Set-Hold $t 'waiting_token' }
  if ($o.kind -eq 'limit') { return Set-Hold $t 'waiting_limit' }
  $v = $o.verdict
  $word = "$($v.result)"
  if ($o.kind -eq 'verdict' -and $word -eq 'hold' -and $HOLDS.ContainsKey("$($v.hold)")) { return Set-Hold $t "$($v.hold)" $v.until }
  # Only a closer closes, so the word of another worker goes to a closer. Panel verdict on BLD-02.
  # shortcut: the closer does not see the claim or the sources tried, BLD-04 adds both to the closer prompt.
  if ($o.kind -eq 'verdict' -and $word -eq 'exhausted') { $t.state = if ($t.state -eq 'closing') { 'closed_exhausted' } else { 'closing' }; return }
  if ($t.state -eq 'needs_panel') {
    if ($o.kind -eq 'failed') { Add-PanelCrash $t } elseif ($word -eq 'pass') { $t.state = $t.panelFrom } else { Set-Park $t }
    return
  }
  if ($o.kind -eq 'verdict' -and $word -eq 'stop_source') { return Set-Panel $t }
  if ($o.kind -eq 'verdict' -and $word -eq 'reopen' -and $t.state -eq 'closing') {
    $gaps = @($v.gaps)
    $returned = @($gaps | Where-Object { $t.gaps -contains $_ }).Count -gt 0
    $t.gaps = @(@($t.gaps) + $gaps | Where-Object { $_ } | Select-Object -Unique)
    $t.attempts++
    $t.state = 'reopened'
    if ($t.attempts -ge $MAX_ATTEMPTS) { Set-Park $t } elseif ($returned) { Set-Panel $t }
    return
  }
  # Only a closer closes, and a research worker with no new counted fact did not pass.
  $want = if ($t.state -eq 'closing') { 'close' } else { 'pass' }
  $noFact = $t.state -eq 'working' -and $t.forecast -gt 0 -and [int]$v.newFacts -eq 0
  if ($o.kind -eq 'verdict' -and $word -eq $want -and -not $noFact) { $t.state = $NEXT[$t.state] } else { Add-Failure $t }
}

# A request of the inbox is the one way into the state from outside. Each other request is refused.
# shortcut: each process of this user can write the inbox, the role allow lists of BLD-04 close this for a worker.
function Move-ByRequest($file) {
  $r = [IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
  if ($time -ge $FREEZE -and ($r.ticket -or $r.to -eq 'ready')) { throw 'after the freeze no ticket opens or returns' }
  if ($r.ticket) {
    $new = Complete-Ticket ($r.ticket | Select-Object id, state, prompt, pilot, forecast, dependsOn)
    if ($new.state -ne 'ready' -or (Test-Path (Join-Path $tickets_dir "$($new.id).json"))) { throw 'not a new ready ticket' }
    return $new
  }
  $t = $tickets | Where-Object { $_.id -eq $r.id }
  if (-not $t) { throw 'no such ticket' }
  switch ("$($t.state)>$($r.to)") {
    'parked>ready' { $t.state = 'ready'; $t.attempts = 0; $t.noPass = 0 }
    'closed>reopened' { $t.state = 'reopened'; $t.gaps = @(@($t.gaps) + @($r.gaps) | Where-Object { $_ } | Select-Object -Unique) }
    'waiting_signature>release' { $t.state = $t.heldFrom }
    default { throw "refused move $_" }
  }
  $t.reason = "$($r.reason)" -replace '\s+', ' '
  $t
}

function Test-Port([string]$address) {
  $h, $p = $address -split ':'
  $c = New-Object Net.Sockets.TcpClient
  try { $c.ConnectAsync($h, [int]$p).Wait(2000) } catch { $false } finally { $c.Close() }
}

# A failure while a service is down, or was down during the run, is the fault of the service. It costs no attempt.
function Set-ServiceFault($o, $w) {
  $failed = $o.kind -eq 'failed' -or "$($o.verdict.result)" -eq 'failed'
  $during = $services.lastDown -and $w.startedAt -and [datetime]$services.lastDown -ge [datetime]$w.startedAt
  if ($failed -and ($down.Count -or $during)) { return @{ kind = 'service'; reason = "a service was down: $($o.reason)" } }
  $o
}

function Send-Alarm($lines) {
  $title = "GAB: $(@($lines).Count) open line(s) for the operator"
  try {
    if ($config.notifyFile) { [IO.File]::AppendAllText($config.notifyFile, "$title | $(@($lines)[0])`r`n", $utf8); return }
    [void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
    $xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent('ToastText02')
    $nodes = $xml.GetElementsByTagName('text')
    [void]$nodes.Item(0).AppendChild($xml.CreateTextNode($title))
    [void]$nodes.Item(1).AppendChild($xml.CreateTextNode(@($lines)[0]))
    $toast = New-Object Windows.UI.Notifications.ToastNotification $xml
    $toast.Tag = 'gab-tick' # A new toast replaces the last one, so the list does not grow.
    [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe').Show($toast)
  } catch { Write-Log "notification failed: $_" }
}

$lock = $null
try { $lock = [IO.File]::Open((Join-Path $StateDir 'tick.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch [IO.IOException] {
  # The stop of the task ends conhost and not its PowerShell child, so a later tick ends a stuck tick.
  # A -RunWorker process waits for a worker, and it stays. Its command line has the same script name.
  # shortcut: a stop between the start and the save of a worker gives a second worker, as each dead tick does, BLD-16 can repair it after an incident.
  $dir = [regex]::Escape($StateDir)
  try {
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object {
      $_.ProcessId -ne $PID -and $_.CommandLine -like '*supervisor-tick.ps1*' -and $_.CommandLine -notlike '*-RunWorker*' -and
      $_.CommandLine -match "-StateDir (`"$dir`"|$dir(\s|$))" -and $_.CreationDate -lt $time.AddMinutes(-$STUCK_MINUTES)
    } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch { Write-Output "stuck tick scan failed: $_" }
  Write-Output 'lock held: another tick runs'
  exit 0
}

try {
  if ($env:GAB_TICK_TEST_HOLD_MS) { Start-Sleep -Milliseconds $env:GAB_TICK_TEST_HOLD_MS } # For the test of the lock.
  $config = [IO.File]::ReadAllText((Join-Path $StateDir 'supervisor.json')) | ConvertFrom-Json
  $alarms = @()
  $tickets = @()
  foreach ($file in @(Get-ChildItem $tickets_dir -Filter '*.json' | Sort-Object Name)) {
    try { $tickets += Complete-Ticket ([IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json) }
    catch { $alarms += "- broken state file: $($file.Name)" }
  }

  # A service of the settings that is down stops each start, and the tick starts its repair.
  # Each tick starts it again: a second start of a service that runs fails and changes nothing.
  $servicesFile = Join-Path $StateDir 'services.json'
  $services = if (Test-Path $servicesFile) { [IO.File]::ReadAllText($servicesFile) | ConvertFrom-Json } else { [pscustomobject]@{ downSince = $null; lastDown = $null } }
  $down = @(@($config.services) | Where-Object { $_ -and -not (Test-Port $_.address) })
  if ($down.Count) {
    if (-not $services.downSince) { $services.downSince = $time.ToString('o') }
    $services.lastDown = $time.ToString('o')
    foreach ($s in $down) {
      Write-Log "service down: $($s.name)"
      # A hidden new window: the tick ends and the service stays.
      if ($s.repair) { try { Start-Process -FilePath $s.repair.command -ArgumentList (@($s.repair.args) | ForEach-Object { Format-Argument $_ }) -WorkingDirectory $s.repair.workDir -WindowStyle Hidden } catch { Write-Log "repair failed: $_" } }
    }
    if ($time -ge ([datetime]$services.downSince).AddMinutes($SERVICE_ALARM_MINUTES)) { $alarms += "- service down for over $SERVICE_ALARM_MINUTES minutes: $(@($down | ForEach-Object { $_.name }) -join ', ')" }
    Save-State $servicesFile $services
  } elseif ($services.downSince) {
    $services.downSince = $null
    Save-State $servicesFile $services
  }

  # Step 1: read the ended workers.
  foreach ($t in $tickets) {
    if (-not $t.worker) { continue }
    if (-not (Test-Running $t.worker)) {
      $t.outcome = Set-ServiceFault (Read-Outcome $t.worker.base) $t.worker
    } elseif (Stop-Overdue $t.worker) {
      $t.outcome = @{ kind = 'failed'; reason = "worker over the limit of $WORKER_HOURS hours" }
    } else { continue }
    $t.worker = $null
    Save-Ticket $t
  }

  $resumeFile = Join-Path $StateDir 'resume.json'
  $resume = if (Test-Path $resumeFile) { [IO.File]::ReadAllText($resumeFile) | ConvertFrom-Json } else { [pscustomobject]@{ worker = $null; stateTicks = 0; retryAt = $null; runs = 0 } }
  if ($resume.worker -and (Test-Running $resume.worker) -and (Stop-Overdue $resume.worker)) {
    # The same state file gets no second resume worker, so the alarm of step 3 fires.
    Write-Log "resume worker over the limit of $WORKER_HOURS hours"
    $resume.worker = $null
    Save-State $resumeFile $resume
  }
  if ($resume.worker -and -not (Test-Running $resume.worker)) {
    $o = Set-ServiceFault (Read-Outcome $resume.worker.base) $resume.worker
    $resume.worker = $null
    # A hold costs no attempt: the same state file can have a new resume worker after the wait.
    if ($o.kind -in 'token', 'limit', 'service') {
      $resume.stateTicks = 0
      $resume.retryAt = $time.AddMinutes($HOLDS["waiting_$($o.kind)"]).ToString('o')
    }
    Write-Log "resume worker ended: $($o.kind) $($o.reason)"
    Save-State $resumeFile $resume
  }

  # Step 2: move one ticket, and copy its state.
  $blocked = $down.Count -or @($tickets | Where-Object { $BLOCK_ALL -contains $_.state }).Count -gt 0
  $running = @($tickets | Where-Object { $_.worker }).Count + [int][bool]$resume.worker
  $cap = if ($null -ne $config.cap) { [int]$config.cap } else { 1 }
  $moved = $null
  $request = $null
  $from = ''
  $t = $tickets | Where-Object { $_.outcome } | Select-Object -First 1
  if ($t) {
    $from = $t.state
    try { Move-ByOutcome $t } catch {
      $t.outcome = $null
      $t.reason = "bad outcome: $_"
      if ($t.state -eq 'needs_panel') { Add-PanelCrash $t } else { Add-Failure $t }
    }
    $moved = $t
  }
  if (-not $moved) {
    foreach ($file in @(Get-ChildItem $inbox_dir -Filter '*.json' | Sort-Object Name)) {
      try {
        $t = $tickets | Where-Object { $_.id -eq ([IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json).id }
        $from = if ($t) { $t.state } else { 'new' }
        $moved = Move-ByRequest $file
        $request = $file.FullName
        if ($from -eq 'new') { $tickets += $moved }
        break
      } catch {
        Write-Log "refused request $($file.Name): $_"
        Move-Item -Force $file.FullName "$($file.FullName).refused"
      }
    }
  }
  if (-not $moved) {
    $done = @($tickets | Where-Object { $_.state -in 'closed', 'closed_exhausted' } | ForEach-Object { $_.id })
    foreach ($t in $tickets) {
      $from = $t.state
      if ($t.state -eq 'parked' -and $time -ge $FREEZE) { $t.state = 'closed_parked' }
      elseif ($HOLDS.ContainsKey($t.state) -and $t.until -and [datetime]$t.until -le $time) { $t.state = $t.heldFrom; $t.until = $null }
      elseif (-not $blocked -and $running -lt $cap -and $t.state -eq 'reopened') { $t.state = 'working' }
      elseif (-not $blocked -and $running -lt $cap -and $t.state -eq 'ready' -and -not @($t.dependsOn | Where-Object { $_ -and $done -notcontains $_ })) {
        $t.state = if ($t.pilot) { 'pilot' } else { 'working' }
      }
      if ($t.state -ne $from) { $moved = $t; break }
    }
  }
  if ($moved) {
    Save-Ticket $moved
    Copy-Item (Join-Path $tickets_dir "$($moved.id).json") (Join-Path $history_dir "$($moved.id).$([datetime]::Now.Ticks).$($moved.state).json") -Force
    if ($request) { Remove-Item $request } # After the save: a crash before it repeats the request, and loses nothing.
    Write-Log "move $($moved.id) $from > $($moved.state): $($moved.reason)"
  }
  $blocked = $down.Count -or @($tickets | Where-Object { $BLOCK_ALL -contains $_.state }).Count -gt 0

  # Step 3: a stale wave-start gets one resume worker for each version of its state file.
  $started = $false
  $wave = $config.waveStart
  if ($resume.retryAt -and [datetime]$resume.retryAt -gt $time) { $alarms += '- the wave-start resume worker waits for a sign-in or a limit' }
  if ($wave -and -not $resume.worker -and (Test-Path $wave.stateFile)) {
    $item = Get-Item $wave.stateFile
    $closed = try { ([IO.File]::ReadAllText($wave.stateFile) | ConvertFrom-Json).end -eq 'closed' } catch { $alarms += '- the wave-start state file is broken'; $true }
    $stale = ($time - $item.LastWriteTime).TotalMinutes -ge $STALE_MINUTES
    if (-not $closed -and $stale -and $resume.stateTicks -eq $item.LastWriteTimeUtc.Ticks) {
      $alarms += '- wave-start has no change after its resume worker'
    } elseif (-not $closed -and $stale -and -not ($resume.retryAt -and [datetime]$resume.retryAt -gt $time)) {
      # The attended session or its driver still runs when a step takes longer than the limit.
      # With no setting the tick cannot know, so it asks and starts nothing.
      $alive = $wave.liveMatch -and @(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$($wave.liveMatch)*" }).Count -gt 0
      if (-not $wave.liveMatch) { $alarms += '- the setting waveStart.liveMatch is missing, so no resume worker starts' }
      elseif (-not $alive -and -not $blocked -and $running -lt $cap) {
        $resume.runs++
        Save-State $resumeFile $resume
        $resume.worker = Start-Worker "wave-start-$($resume.runs)" $wave.prompt
        $resume.stateTicks = $item.LastWriteTimeUtc.Ticks
        $resume.retryAt = $null
        Save-State $resumeFile $resume
        $running++
        $started = $true
      }
    }
  }

  # Step 3: start one worker, up to the cap. A blocked tick starts none.
  if (-not $started -and -not $blocked -and $running -lt $cap) {
    $t = $tickets | Where-Object { $WORK -contains $_.state -and -not $_.worker -and -not $_.outcome } | Select-Object -First 1
    if ($t) {
      $t.runs++
      Save-Ticket $t # Before the start: a crash after it must not give a new worker the paths of this one.
      $gaps = if ($t.gaps) { "Gaps to fix: $(@($t.gaps) -join '; ')`n" } else { '' }
      $prompt = "$($t.prompt)`n`nTicket: $($t.id). State: $($t.state). Run: $($t.runs).`n$gaps" +
      'End with one line of JSON, with no double quote inside a value: {"result":"pass|close|reopen|failed|hold|exhausted|stop_source","hold":"<waiting state>","newFacts":0,"gaps":[],"reason":"<one sentence>"}'
      $t.worker = Start-Worker "$($t.id)-$($t.runs)" $prompt
      Save-Ticket $t
      $running++
    }
  }

  # Step 4: write the status file, and send a notification while an alarm is open.
  if (Test-Path $queue) { $alarms += @([IO.File]::ReadAllLines($queue, $utf8) | Where-Object { $_ -match '^- (?!\[x\])' }) }
  $alarms += @($tickets | Where-Object { $ALARM_HOLDS -contains $_.state } | ForEach-Object { "- $($_.id) is in $($_.state): the operator must act" })
  $alarms += @($tickets | Where-Object { $_.state -eq 'waiting_service' -and $_.serviceHolds -ge $SERVICE_ALARM_HOLDS } | ForEach-Object { "- $($_.id) has $($_.serviceHolds) holds for a service or the network: $($_.reason)" })
  Save-State (Join-Path $StateDir 'status.json') @{
    at      = $time.ToString('o')
    cap     = $cap
    running = $running
    alarms  = @($alarms)
    tickets = @($tickets | ForEach-Object { @{ id = $_.id; state = $_.state; attempts = $_.attempts; reason = $_.reason } })
  }
  if ($alarms.Count) { Send-Alarm $alarms }
} catch {
  $failure = "- the tick failed: $_ at line $($_.InvocationInfo.ScriptLineNumber)"
  Write-Log $failure
  Save-State (Join-Path $StateDir 'status.json') @{ at = $time.ToString('o'); alarms = @($failure); tickets = @() }
  Send-Alarm @($failure)
  throw
} finally {
  $lock.Close()
}
