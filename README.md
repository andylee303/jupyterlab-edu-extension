# JupyterLab 教學擴展

[![JupyterLab](https://img.shields.io/badge/JupyterLab-4.x-orange)](https://jupyterlab.readthedocs.io/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

一個功能完整的 JupyterLab 擴展，專為程式設計教學情境設計。提供學生身份驗證、操作追蹤、ChatGPT AI 助教整合與學習分析功能。

## ✨ 功能特色

- 🔐 **學生身份驗證**：學號和姓名登入，自動追蹤學習歷程
- 🛡️ **登入覆蓋層**：未登入時顯示全螢幕覆蓋，確保學習記錄完整
- 🤖 **ChatGPT AI 助教**：自動分析程式錯誤，提供繁體中文解說
- 📊 **操作歷程追蹤**：自動記錄每次程式執行
- ☁️ **雲端儲存**：資料自動同步至雲端資料庫（選配）

---

## 🎯 快速安裝指南

### 請選擇您的作業系統：

<details>
<summary><b>🍓 樹莓派 (Raspberry Pi)</b></summary>

#### 方法一：一鍵安裝（推薦）

在終端機中執行以下指令：
```bash
curl -sSL https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install_on_pi.sh | bash
```

#### 方法二：手動安裝

```bash
# 1. 安裝擴展
pip install jupyterlab jupyterlab-edu-extension

# 2. 啟動（允許遠端連線）
jupyter lab --ip=0.0.0.0 --no-browser
```

從電腦瀏覽器訪問：`http://樹莓派IP:8888`

</details>

<details>
<summary><b>🪟 Windows</b></summary>

#### 方法一：一鍵安裝（推薦）

1. 按 `Win + X`，選擇「Windows PowerShell」
2. 複製貼上以下指令後按 Enter：

```powershell
irm https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install.ps1 | iex
```

#### 方法二：手動安裝

1. 安裝 [Python 3.11+](https://www.python.org/downloads/)（安裝時勾選「Add Python to PATH」）
2. 開啟 PowerShell，執行：

```powershell
pip install jupyterlab jupyterlab-edu-extension
jupyter lab
```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

#### 方法一：一鍵安裝（推薦）

開啟「終端機」，執行：
```bash
curl -sSL https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install.sh | bash
```

#### 方法二：手動安裝

```bash
# 如果沒有 Python，先用 Homebrew 安裝
brew install python@3.11

# 安裝擴展
pip3 install jupyterlab jupyterlab-edu-extension

# 啟動
jupyter lab
```

</details>

<details>
<summary><b>🐧 Linux</b></summary>

#### 方法一：一鍵安裝（推薦）

```bash
curl -sSL https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install.sh | bash
```

#### 方法二：手動安裝

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install python3.11 python3.11-venv -y

# 安裝擴展
pip3 install jupyterlab jupyterlab-edu-extension

# 啟動
jupyter lab
```

</details>

---

## 📱 首次使用

1. 開啟 JupyterLab 後，會看到「請先登入」覆蓋層
2. 點擊「學生登入」按鈕
3. 輸入學號和姓名
4. 點擊「登入」開始學習！

> 💡 **提示**：如果 AI 助教功能需要設定，系統會自動彈出設定對話框，請輸入教師提供的 API Key。

---

## 👨‍🏫 教師/管理員指南

<details>
<summary><b>點擊展開</b></summary>

### 開發環境設置

```bash
# 複製專案
git clone https://github.com/andylee303/jupyterlab-edu-extension.git
cd jupyterlab-edu-extension

# 設置環境變數
cp .env.example .env
# 編輯 .env 填入 API 金鑰

# 建立虛擬環境
python -m venv .venv
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # macOS/Linux

# 安裝依賴
pip install -e .
npm install
npm run build

# 啟動開發伺服器
jupyter lab
```

### 發布到 PyPI

```bash
# 打包
python -m build

# 上傳
twine upload dist/*
```

### 配置說明

| 配置項 | 說明 | 必要性 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 金鑰 | ✅ 必要 |
| `OPENAI_MODEL` | 使用的模型 | 選配（預設：gpt-4o-mini） |
| `SUPABASE_URL` | Supabase URL | 選配（雲端儲存） |
| `SUPABASE_ANON_KEY` | Supabase Key | 選配（雲端儲存） |

</details>

---

## 📁 專案結構

```
jupyterlab-edu-extension/
├── jupyterlab_edu_extension/   # Python 後端
│   ├── handlers.py             # API 路由
│   ├── config.py               # 配置管理
│   └── services/               # 業務邏輯
├── src/                        # TypeScript 前端
│   ├── index.ts                # 入口點
│   ├── services/               # 前端服務
│   └── widgets/                # UI 組件
├── style/                      # CSS 樣式
├── scripts/                    # 安裝腳本
└── pyproject.toml              # 專案配置
```

---

## 🐛 常見問題

<details>
<summary><b>Q: 安裝時出現「找不到 Python」？</b></summary>

Windows 用戶請確認安裝 Python 時有勾選「Add Python to PATH」。如果沒有，請重新安裝 Python 並勾選此選項。
</details>

<details>
<summary><b>Q: 登入按鈕沒反應？</b></summary>

請按 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（macOS）強制重新整理瀏覽器。
</details>

<details>
<summary><b>Q: AI 助教沒有回應？</b></summary>

請確認已正確設定 OpenAI API Key。可在設定對話框中重新輸入。
</details>

<details>
<summary><b>Q: 樹莓派上無法遠端連線？</b></summary>

確認啟動指令包含 `--ip=0.0.0.0`：
```bash
jupyter lab --ip=0.0.0.0 --no-browser
```
並確認防火牆允許 8888 port。
</details>

---

## 📝 授權

MIT License - 詳見 [LICENSE](LICENSE)

## 🙏 致謝

- [JupyterLab](https://jupyterlab.readthedocs.io/)
- [OpenAI](https://openai.com/)
- [Supabase](https://supabase.com/)
