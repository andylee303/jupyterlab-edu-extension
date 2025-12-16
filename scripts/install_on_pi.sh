#!/bin/bash
# =============================================
# JupyterLab 教學擴展 - 樹莓派快速安裝腳本
# =============================================
# 使用方法: curl -sSL https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install_on_pi.sh | bash

set -e

echo "================================================"
echo "  JupyterLab 教學擴展 - 樹莓派安裝程式"
echo "================================================"
echo ""

# 檢查是否為樹莓派
if [[ ! -f /proc/device-tree/model ]] || ! grep -qi "raspberry" /proc/device-tree/model 2>/dev/null; then
    echo "⚠️  警告: 可能不是樹莓派環境，但仍將繼續安裝..."
fi

# 檢查 Python 版本
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
REQUIRED_VERSION="3.11"

if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]]; then
    echo "❌ 錯誤: 需要 Python 3.11 或更高版本"
    echo "   目前版本: Python $PYTHON_VERSION"
    echo ""
    echo "   請執行以下命令安裝 Python 3.11:"
    echo "   sudo apt update && sudo apt install python3.11 python3.11-venv -y"
    exit 1
fi

echo "✅ Python 版本: $PYTHON_VERSION"

# 建立工作目錄
INSTALL_DIR="$HOME/jupyterlab-edu"
mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

echo ""
echo "📁 安裝目錄: $INSTALL_DIR"

# 建立虛擬環境
echo ""
echo "🔧 建立 Python 虛擬環境..."
python3 -m venv .venv
source .venv/bin/activate

# 升級 pip
echo ""
echo "📦 升級 pip..."
pip install --upgrade pip

# 安裝擴展
echo ""
echo "📥 安裝 JupyterLab 教學擴展..."
pip install jupyterlab git+https://github.com/andylee303/jupyterlab-edu-extension.git

# 建立啟動腳本
echo ""
echo "📝 建立啟動腳本..."
cat > start.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
source .venv/bin/activate

# 取得 IP 地址
IP=$(hostname -I | awk '{print $1}')

echo ""
echo "================================================"
echo "  JupyterLab 教學擴展"
echo "================================================"
echo ""
echo "🌐 請在電腦瀏覽器中開啟:"
echo "   http://$IP:8888"
echo ""
echo "按 Ctrl+C 停止服務"
echo ""

jupyter lab --ip=0.0.0.0 --no-browser --NotebookApp.token='' --NotebookApp.password=''
EOF

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
echo "🚀 啟動 JupyterLab:"
echo "   cd $INSTALL_DIR && ./start.sh"
echo ""
echo "🔑 首次啟動時，請在瀏覽器中設定 OpenAI API Key"
echo ""

# 詢問是否設定開機自動啟動
read -p "是否設定開機自動啟動 JupyterLab? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # 建立 systemd 服務
    sudo tee /etc/systemd/system/jupyterlab.service > /dev/null << SYSTEMD
[Unit]
Description=JupyterLab 教學擴展
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/.venv/bin/jupyter lab --ip=0.0.0.0 --no-browser --NotebookApp.token='' --NotebookApp.password=''
Restart=on-failure
RestartSec=10
Environment=PATH=$INSTALL_DIR/.venv/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
SYSTEMD

    sudo systemctl daemon-reload
    sudo systemctl enable jupyterlab
    sudo systemctl start jupyterlab
    
    echo ""
    echo "✅ 已設定開機自動啟動！"
    echo ""
    echo "📋 管理指令："
    echo "   查看狀態：sudo systemctl status jupyterlab"
    echo "   停止服務：sudo systemctl stop jupyterlab"
    echo "   重新啟動：sudo systemctl restart jupyterlab"
    echo "   取消開機啟動：sudo systemctl disable jupyterlab"
    echo ""
    
    # 取得 IP 地址
    IP=$(hostname -I | awk '{print $1}')
    echo "🌐 JupyterLab 已在背景執行！"
    echo "   請在電腦瀏覽器開啟: http://$IP:8888"
else
    # 詢問是否立即啟動
    read -p "是否現在啟動 JupyterLab? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./start.sh
    fi
fi
