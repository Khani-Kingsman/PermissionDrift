<#
.SYNOPSIS
    PermissionDrift — Windows Task Scheduler Background Task Manager.
.DESCRIPTION
    Registers a lightweight Windows Scheduled Task via native schtasks.exe.
    SAFETY & CORRECTNESS REQUIREMENTS:
    1. NEVER RUNS AS SYSTEM: Explicitly specifies /RU $env:USERNAME so %USERPROFILE%
       resolves to the actual developer's home directory (e.g. C:\Users\<Username>),
       NOT C:\Windows\System32\config\systemprofile.
    2. ABSOLUTE PATH RESOLUTION: Resolves the exact absolute path to python.exe and
       cli.py / scanner.py at registration time.
    3. SINGLE INSTANCE: Prevents overlapping instances if a scan is already running.
    4. NO ALWAYS-ON SERVICE: Uses Task Scheduler on an interval (default 30 mins)
       instead of a memory-heavy daemon.
#>

param (
    [ValidateSet("Install", "Uninstall", "Status", "RunNow")]
    [string]$Action = "Install",

    [int]$IntervalMinutes = 30
)

$TaskName = "PermissionDrift_Scan"
$ProjectDir = (Get-Item $PSScriptRoot).Parent.FullName
$PythonExe = (Get-Command pythonw.exe -ErrorAction SilentlyContinue).Source
if (-not $PythonExe) {
    $PythonExe = (Get-Command python.exe -ErrorAction SilentlyContinue).Source
}

if (-not $PythonExe) {
    Write-Error "Python was not found on PATH. Please ensure pythonw.exe or python.exe is available."
    exit 1
}

$ScriptPath = Join-Path $ProjectDir "cli.py"
$CurrentUsername = $env:USERNAME

switch ($Action) {
    "Install" {
        Write-Host "Registering Scheduled Task '$TaskName' under user '$CurrentUsername'..." -ForegroundColor Cyan
        Write-Host "Python Executable : $PythonExe"
        Write-Host "Script Target     : $ScriptPath"
        Write-Host "Interval          : Every $IntervalMinutes minutes"

        # Action command: runs python.exe "d:\PermissionDrift\cli.py" scan
        $TaskCommand = "`"$PythonExe`" `"$ScriptPath`" scan"

        # schtasks /Create:
        # /TN "PermissionDrift_Scan"
        # /TR "..."
        # /SC MINUTE /MO $IntervalMinutes
        # /RU "$CurrentUsername" (Run under current user identity, NEVER SYSTEM)
        # /RL LIMITED (least-privilege standard user rights)
        # /F (force overwrite if exists)
        $schtasksCmd = "schtasks.exe /Create /TN `"$TaskName`" /TR `"$TaskCommand`" /SC MINUTE /MO $IntervalMinutes /RU `"$CurrentUsername`" /RL LIMITED /F"
        Invoke-Expression $schtasksCmd

        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nTask successfully created with user identity '$CurrentUsername'!" -ForegroundColor Green
            Write-Host "The scanner will execute every $IntervalMinutes minutes in the background."
            Write-Host "To verify status : powershell .\scripts\schedule_task.ps1 -Action Status"
            Write-Host "To trigger test  : powershell .\scripts\schedule_task.ps1 -Action RunNow"
            Write-Host "To uninstall     : powershell .\scripts\schedule_task.ps1 -Action Uninstall"
        } else {
            Write-Error "Failed to register scheduled task. Error code: $LASTEXITCODE"
        }
    }

    "Uninstall" {
        Write-Host "Unregistering Scheduled Task '$TaskName'..." -ForegroundColor Yellow
        schtasks.exe /Delete /TN "$TaskName" /F
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Scheduled task '$TaskName' successfully deleted." -ForegroundColor Green
        }
    }

    "Status" {
        Write-Host "Querying details for task '$TaskName'..." -ForegroundColor Cyan
        schtasks.exe /Query /TN "$TaskName" /FO LIST /V
    }

    "RunNow" {
        Write-Host "Manually triggering execution of '$TaskName'..." -ForegroundColor Cyan
        schtasks.exe /Run /TN "$TaskName"
    }
}
