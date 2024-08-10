# execute unity editor with the given path and Arguments
param(
    [string]$EditorPath,
    [string]$Arguments,
    [string]$LogPath
)
$process = $null
try {
    if (-not $EditorPath) {
        throw "-EditorPath is a required input"
    }
    Write-Host "::debug::Unity editor path: $EditorPath"
    if (-not $Arguments) {
        throw "Arguments is a required input"
    }
    Write-Host "::debug::Unity Editor Arguments: $Arguments"
    if (-not $LogPath) {
        throw "LogPath is a required input"
    }
    Write-Host "::debug::Log Path: $LogPath"
    Write-Host "[command]"$EditorPath" $Arguments"
    $process = Start-Process -FilePath "$EditorPath" -ArgumentList "$Arguments" -PassThru
    $lJob = Start-Job -ScriptBlock {
        param($log)
        while (-not (Test-Path $log -Type Leaf)) {
            Start-Sleep -Milliseconds 1
        }
        Get-Content $log -Wait | Write-Host
    } -ArgumentList $LogPath
    $processId = $process.Id
    Write-Host "::debug::Unity process started with pid: $processId"
    $processId | Out-File -FilePath "$env:GITHUB_WORKSPACE/unity-process-id.txt"
    while (-not $process.HasExited) {
        Start-Sleep -Milliseconds 1
        Receive-Job $ljob
        if ($null -eq (Get-Process -Id $processId -ErrorAction SilentlyContinue)) { break }
    }
    $fileLocked = $true
    $timeout = New-TimeSpan -Seconds 10
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    do {
        try {
            if (Test-Path -Path $LogPath) {
                $file = Convert-Path $LogPath
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
        if ($stopwatch.elapsed -lt $timeout) {
            if ((-not $global:PSVersionTable.Platform) -or ($global:PSVersionTable.Platform -eq "Win32NT")) {
                $procsWithParent = Get-CimInstance -ClassName "win32_process" | Select-Object ProcessId, ParentProcessId
                $orphaned = $procsWithParent | Where-Object -Property ParentProcessId -NotIn $procsWithParent.ProcessId
                $procs = Get-Process -IncludeUserName | Where-Object -Property Id -In $orphaned.ProcessId | Where-Object {
                    $_.UserName -match $env:username
                }
                $procs | ForEach-Object {
                    Stop-Process -Id $_.Id -ErrorAction SilentlyContinue
                }
            }
        }
        Start-Sleep -Milliseconds 1
    } while ($fileLocked)
    Start-Sleep -Milliseconds 1
    Receive-Job $ljob
    Stop-Job $ljob
    Remove-Job $ljob
    $exitCode = [int]$process.ExitCode
    Write-Host "Unity Process Exit Code: $exitCode"
    exit $exitCode
}
catch {
    $errorMessage = $_.Exception.Message
    Write-Host "::error::Unity.ps1: $errorMessage"
    if ($process -and (-not $process.HasExited)) {
        $process.Kill()
    }
    exit 1
}
