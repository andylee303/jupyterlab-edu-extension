#!/bin/bash
# =============================================
# JupyterLab 教學擴展 - Linux/macOS 安裝腳本
# =============================================
# 使用方法: 
#   curl -sSL https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install.sh | bash
# 或者下載後執行:
#   chmod +x install.sh && ./install.sh

set -e

echo ""
echo "================================================"
echo "  JupyterLab 教學擴展 - 安裝程式"
echo "================================================"
echo ""

# 檢測作業系統
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_NAME="Linux";;
    Darwin*)    OS_NAME="macOS";;
    *)          OS_NAME="Unknown";;
esac

echo "🖥️  偵測到作業系統: $OS_NAME"

# 檢查 Python 版本
if ! command -v python3 &> /dev/null; then
    echo "❌ 錯誤: 找不到 Python3"
    echo ""
    echo "請先安裝 Python 3.11 或更高版本:"
    if [[ "$OS_NAME" == "macOS" ]]; then
        echo "  brew install python@3.11"
    else
        echo "  sudo apt update && sudo apt install python3.11 python3.11-venv -y"
    fi
    exit 1
fi

PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
REQUIRED_VERSION="3.11"

if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    echo "❌ 錯誤: 需要 Python 3.11 或更高版本"
    echo "   目前版本: Python $PYTHON_VERSION"
    exit 1
fi

echo "✅ Python 版本: $PYTHON_VERSION"

# 建立工作目錄
INSTALL_DIR="$HOME/jupyterlab-edu"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo "📁 安裝目錄: $INSTALL_DIR"

# 建立虛擬環境
echo ""
echo "🔧 建立 Python 虛擬環境..."
python3 -m venv .venv

# 啟動虛擬環境
source .venv/bin/activate

# 升級 pip
echo ""
echo "📦 升級 pip..."
pip install --upgrade pip --quiet

# 安裝擴展
echo ""
echo "📥 安裝 JupyterLab 教學擴展..."
pip install jupyterlab jupyterlab-edu-extension --quiet

# 建立啟動腳本
echo ""
echo "📝 建立啟動腳本..."
cat > start.sh << 'SCRIPT'
#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate

echo ""
echo "================================================"
echo "  JupyterLab 教學擴展"
echo "================================================"
echo ""
echo "🌐 請在瀏覽器中開啟顯示的連結"
echo ""
echo "按 Ctrl+C 停止服務"
echo ""

jupyter lab
SCRIPT

chmod +x start.sh

# 建立配置目錄
mkdir -p "$HOME/.jupyterlab-edu-extension"

echo ""
echo "================================================"
echo "  ✅ 安裝完成！"
echo "================================================"
echo ""
echo "📍 安裝位置: $INSTALL_DIR"
echo ""
echo "🚀 啟動方式:"
echo "   cd $INSTALL_DIR && ./start.sh"
echo ""
echo "🔑 首次啟動時，請在瀏覽器中設定 OpenAI API Key"
echo ""

# 詢問是否立即啟動
read -p "是否現在啟動 JupyterLab? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./start.sh
fi
