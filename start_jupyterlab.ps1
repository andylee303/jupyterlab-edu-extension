# JupyterLab 教學擴展 - 啟動腳本

# 設置 UTF-8 編碼
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 啟動虛擬環境
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
& "$scriptPath\.venv\Scripts\activate.ps1"

# 載入 .env 檔案（如果存在）
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
    Write-Host "已載入 .env 設定"
}

# 啟動 JupyterLab
Write-Host ""
Write-Host "正在啟動 JupyterLab..." -ForegroundColor Green
Write-Host "請在瀏覽器開啟顯示的 URL" -ForegroundColor Yellow
Write-Host ""

jupyter lab
