# =============================================
# JupyterLab 教學擴展 - Windows 安裝腳本
# =============================================
# 使用方法: 
#   在 PowerShell 中執行:
#   irm https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install.ps1 | iex
# 或者下載後執行:
#   .\install.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  JupyterLab 教學擴展 - Windows 安裝程式" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 檢查 Python
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python (\d+\.\d+)") {
        $version = [version]$matches[1]
        if ($version -lt [version]"3.11") {
            throw "版本過低"
        }
        Write-Host "✅ $pythonVersion" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ 錯誤: 需要 Python 3.11 或更高版本" -ForegroundColor Red
    Write-Host ""
    Write-Host "請從以下網址下載並安裝 Python:" -ForegroundColor Yellow
    Write-Host "   https://www.python.org/downloads/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "安裝時請勾選 'Add Python to PATH'" -ForegroundColor Yellow
    exit 1
}

# 設定安裝目錄
$installDir = "$env:USERPROFILE\jupyterlab-edu"
Write-Host "📁 安裝目錄: $installDir"

# 建立目錄
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}
Set-Location $installDir

# 建立虛擬環境
Write-Host ""
Write-Host "🔧 建立 Python 虛擬環境..." -ForegroundColor Yellow
python -m venv .venv

# 啟動虛擬環境
& ".\.venv\Scripts\activate.ps1"

# 升級 pip
Write-Host ""
Write-Host "📦 升級 pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip --quiet

# 安裝擴展
Write-Host ""
Write-Host "📥 安裝 JupyterLab 教學擴展..." -ForegroundColor Yellow
pip install jupyterlab git+https://github.com/andylee303/jupyterlab-edu-extension.git --quiet

# 建立啟動腳本
Write-Host ""
Write-Host "📝 建立啟動腳本..." -ForegroundColor Yellow

$startScript = @'
# JupyterLab 教學擴展 - 啟動腳本
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
& "$scriptPath\.venv\Scripts\activate.ps1"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  JupyterLab 教學擴展" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "瀏覽器應該會自動開啟..." -ForegroundColor Green
Write-Host "如果沒有，請手動開啟顯示的連結" -ForegroundColor Yellow
Write-Host ""
Write-Host "按 Ctrl+C 停止服務" -ForegroundColor Gray
Write-Host ""

jupyter lab
'@

$startScript | Out-File -FilePath "start.ps1" -Encoding UTF8

# 建立配置目錄
$configDir = "$env:USERPROFILE\.jupyterlab-edu-extension"
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  ✅ 安裝完成！" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 安裝位置: $installDir" -ForegroundColor White
Write-Host ""
Write-Host "🚀 啟動方式:" -ForegroundColor White
Write-Host "   cd $installDir" -ForegroundColor Gray
Write-Host "   .\start.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "🔑 首次啟動時，請在瀏覽器中設定 OpenAI API Key" -ForegroundColor Yellow
Write-Host ""

# 詢問是否立即啟動
$response = Read-Host "是否現在啟動 JupyterLab? (y/n)"
if ($response -eq 'y' -or $response -eq 'Y') {
    & ".\start.ps1"
}
