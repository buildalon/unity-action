# execute unity editor with the given path and array of arguments
param(
    [string]$editorPath,
    [string[]]$arguments
)
$process = $null
try {
    if (-not $editorPath) {
        throw "-editorPath is a required argument"
    }
    if (-not $arguments) {
        throw "-arguments is a required argument"
    }
    $logPath = $arguments | Where-Object { $_ -like "-logFile" } | Select-Object -First 1 -Skip 1
    if (-not $logPath) {
        $logDirectory = "$env:GITHUB_WORKSPACE/Logs"
        if (-not (Test-Path logDirectory)) {
            $logDirectory = New-Item -ItemType Directory -Force -Path $logDirectory | Select-Object
        }
        $date = Get-Date -Format 'yyyyMMTddTHHmmss'
        $logPath = "$logDirectory/Unity-$date.log"
        $arguments = $arguments | Where-Object { $_ -ne "-logFile" }
        $arguments += "-logFile"
        $arguments += $logPath
    }
    $argumentsString = $arguments -join ' '
    Write-Host "`"$editorPath`" $argumentsString"
    $process = Start-Process -FilePath "$editorPath" -ArgumentList "$argumentsString" -PassThru
    $lJob = Start-Job -ScriptBlock {
        param($log)
        while (-not (Test-Path $log -Type Leaf)) {
            Start-Sleep -Milliseconds 1
        }
        Get-Content $log -Wait | Write-Host
    } -ArgumentList $logPath
    $processId = $process.Id
    Write-Output "::debug::Unity process started with pid: $processId"
    $processId | Out-File -FilePath "$env:GITHUB_WORKSPACE/unity-process-id.txt"
    while ( -not $process.HasExited ) {
        Start-Sleep -Milliseconds 1
        Receive-Job $ljob
        if ( $null -eq (Get-Process -Id $processId -ErrorAction SilentlyContinue) ) {
            break
        }
    }
    $fileLocked = $true
    $timeout = New-TimeSpan -Seconds 10
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    do {
        try {
            if (Test-Path -Path $logPath) {
                $file = Convert-Path $logPath
                $fileStream = [System.IO.File]::Open($file, 'Open', 'Write')
                $fileStream.Close()
                $fileStream.Dispose()
                $fileLocked = $false
            }
            else {
                $fileLocked = $false
            }
        }
        catch {
            $fileLocked = $true
            Start-Sleep -Milliseconds 1
        }
        if ( $stopwatch.elapsed -lt $timeout ) {
            if ( (-not $global:PSVersionTable.Platform) -or ($global:PSVersionTable.Platform -eq "Win32NT") ) {
                $procsWithParent = Get-CimInstance -ClassName "win32_process" | Select-Object ProcessId, ParentProcessId
                $orphaned = $procsWithParent | Where-Object -Property ParentProcessId -NotIn $procsWithParent.ProcessId
                $procs = Get-Process -IncludeUserName | Where-Object -Property Id -In $orphaned.ProcessId | Where-Object { $_.UserName -match $env:username }
                $procs | ForEach-Object { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue }
            }
        }
        Start-Sleep -Milliseconds 1
    } while ($fileLocked)
    Start-Sleep -Milliseconds 1
    Receive-Job $ljob
    Stop-Job $ljob
    Remove-Job $ljob
    exit [int]$process.ExitCode
}
catch {
    $errorMessage = $_.Exception.Message
    Write-Host "::error::$errorMessage"
    if ($process -and (-not $process.HasExited)) {
        $process.Kill()
    }
    exit 1
}
