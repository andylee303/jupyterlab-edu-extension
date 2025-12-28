# JupyterLab 教學擴展

[![JupyterLab](https://img.shields.io/badge/JupyterLab-4.x-orange)](https://jupyterlab.readthedocs.io/)
[![Python](https://img.shields.io/badge/Python-3.11+-blue)](https://python.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

一個功能完整的 JupyterLab 擴展，專為程式設計教學情境設計。提供學生身份驗證、操作追蹤、ChatGPT AI 助教整合與學習分析功能。

## ✨ 功能特色

- 🔐 **學生身份驗證**：學號和姓名登入，自動追蹤學習歷程
- 🛡️ **登入覆蓋層**：未登入時顯示全螢幕覆蓋，確保學習記錄完整
- 🤖 **ChatGPT AI 助教**：自動分析程式錯誤，提供繁體中文解說（串流即時顯示）
- 📊 **操作歷程追蹤**：自動記錄每次程式執行
- ☁️ **雲端儲存**：資料自動同步至 Supabase 雲端資料庫（選配）

---

## 📋 目錄

- [🎓 學生安裝指南](#-學生安裝指南)
- [👨‍🏫 教師/管理員指南](#-教師管理員指南)
- [🛠️ 開發者指南](#️-開發者指南)
- [📁 專案結構](#-專案結構)
- [🐛 常見問題](#-常見問題)

---

## 🎓 學生安裝指南

> 💡 **給學生的說明**：請依照老師指定的平台（Windows、macOS 或樹莓派）安裝。如遇問題請詢問老師。

### 🪟 Windows 安裝步驟

#### 步驟 1：安裝 Python

1. 前往 [Python 官網](https://www.python.org/downloads/)
2. 點擊「Download Python 3.12.x」下載
3. 執行安裝程式時，**務必勾選「Add python.exe to PATH」**
4. 點擊「Install Now」完成安裝

#### 步驟 2：安裝 JupyterLab 教學擴展

1. 按 `Win + X`，選擇「終端機」或「Windows PowerShell」
2. 複製貼上以下指令，按 Enter：

```powershell
pip install jupyterlab git+https://github.com/andylee303/jupyterlab-edu-extension.git
```

3. 等待安裝完成（約 3-5 分鐘）

#### 步驟 3：啟動 JupyterLab

```powershell
jupyter lab
```

瀏覽器會自動開啟。輸入學號和姓名登入即可開始學習！

---

### 🍎 macOS 安裝步驟

#### 步驟 1：安裝 Python（如果尚未安裝）

1. 按 `Cmd + Space`，輸入「終端機」並開啟
2. 執行以下指令安裝 Homebrew（如果已安裝可跳過）：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

3. 安裝 Python：

```bash
brew install python@3.11
```

#### 步驟 2：安裝 JupyterLab 教學擴展

```bash
pip3 install jupyterlab git+https://github.com/andylee303/jupyterlab-edu-extension.git
```

#### 步驟 3：啟動 JupyterLab

```bash
jupyter lab
```

---

### 🍓 樹莓派安裝步驟

#### 方法一：一鍵安裝（推薦）

在終端機中執行：

```bash
curl -sSL https://raw.githubusercontent.com/andylee303/jupyterlab-edu-extension/main/scripts/install_on_pi.sh | bash
```

#### 方法二：手動安裝

```bash
# 1. 確認 Python 版本 >= 3.11
python3 --version

# 2. 安裝擴展
pip3 install jupyterlab git+https://github.com/andylee303/jupyterlab-edu-extension.git

# 3. 啟動（允許遠端連線）
jupyter lab --ip=0.0.0.0 --no-browser
```

從電腦瀏覽器訪問：`http://樹莓派IP:8888`

---

## 👨‍🏫 教師/管理員指南

> 💡 **給教師的說明**：本擴展需要配置 OpenAI API 才能啟用 AI 助教功能。Supabase 用於雲端儲存學生學習記錄（選配）。

### 第一部分：安裝擴展

請先依照上方的[學生安裝指南](#-學生安裝指南)完成基本安裝。

### 第二部分：配置 OpenAI API（必要）

AI 助教功能需要 OpenAI API Key 才能運作。

#### 步驟 1：取得 OpenAI API Key

1. 前往 [OpenAI Platform](https://platform.openai.com/)
2. 註冊或登入帳號
3. 點擊右上角頭像 → 「View API keys」
4. 點擊「Create new secret key」
5. 複製產生的 API Key（以 `sk-` 開頭）

> ⚠️ **重要**：API Key 只會顯示一次，請妥善保存！

#### 步驟 2：設定 API Key

**方法 A：透過 JupyterLab 介面設定（推薦）**

1. 啟動 JupyterLab
2. 登入後，系統會自動彈出設定對話框
3. 輸入您的 OpenAI API Key
4. 點擊「儲存」

**方法 B：透過環境變數設定**

在終端機中設定（每次啟動前都需要）：

```powershell
# Windows PowerShell
$env:OPENAI_API_KEY = "sk-your-api-key-here"
jupyter lab
```

```bash
# macOS/Linux
export OPENAI_API_KEY="sk-your-api-key-here"
jupyter lab
```

**方法 C：使用 .env 檔案（永久設定）**

系統會自動搜尋以下位置的 `.env` 檔案：

1. **用戶配置目錄（推薦）**：
   - Windows: `C:\Users\您的用戶名\.jupyterlab-edu-extension\.env`
   - macOS/Linux: `~/.jupyterlab-edu-extension/.env`

2. JupyterLab 啟動時的當前目錄

建立配置目錄並設定 `.env`：

```powershell
# Windows PowerShell
mkdir "$env:USERPROFILE\.jupyterlab-edu-extension" -Force
notepad "$env:USERPROFILE\.jupyterlab-edu-extension\.env"
```

```bash
# macOS/Linux
mkdir -p ~/.jupyterlab-edu-extension
nano ~/.jupyterlab-edu-extension/.env
```

在 `.env` 檔案中輸入：

```
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

#### 步驟 3：選擇模型（選配）

預設使用 `gpt-4o-mini`（成本較低）。如需使用其他模型：

```
OPENAI_MODEL=gpt-4o
```

---

### 第三部分：配置 Supabase 雲端儲存（選配）

Supabase 用於儲存學生的學習記錄，方便教師追蹤學習進度。

#### 步驟 1：建立 Supabase 專案

1. 前往 [Supabase](https://supabase.com/) 並註冊帳號
2. 點擊「New Project」建立新專案
3. 設定專案名稱和資料庫密碼
4. 等待專案建立完成（約 2 分鐘）

#### 步驟 2：取得 API 金鑰

1. 進入專案後，點擊左側「Project Settings」
2. 選擇「API」
3. 複製以下資訊：
   - **Project URL**（例如：`https://xxxxx.supabase.co`）
   - **anon public** key（公開金鑰）
   - **service_role** key（服務金鑰，用於後端）

#### 步驟 3：建立資料表

1. 點擊左側「SQL Editor」
2. 複製並執行 `scripts/supabase_setup.sql` 中的 SQL 語句
3. 或手動建立以下資料表：

```sql
-- 學生資料表
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 執行記錄表
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    student_id TEXT REFERENCES students(student_id),
    cell_id TEXT,
    cell_content TEXT,
    output TEXT,
    error_output TEXT,
    chatgpt_analysis TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 步驟 4：設定環境變數

將 Supabase 資訊加入環境變數或 `.env` 檔案：

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

### 配置項目總覽

| 配置項 | 說明 | 必要性 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API 金鑰 | ✅ 必要（AI 助教功能） |
| `OPENAI_MODEL` | 使用的模型 | 選配（預設：gpt-4o-mini） |
| `SUPABASE_URL` | Supabase 專案 URL | 選配（雲端儲存） |
| `SUPABASE_ANON_KEY` | Supabase 公開金鑰 | 選配（雲端儲存） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服務金鑰 | 選配（雲端儲存） |

---

## 🛠️ 開發者指南

> 💡 **給開發者的說明**：本節說明如何從零開始建置和修改此專案。

### 前置需求

| 工具 | 版本 | 說明 |
|------|------|------|
| Python | 3.11+ | 後端開發 |
| Node.js | 18+ | 前端開發（TypeScript 編譯） |
| npm | 9+ | 套件管理 |
| Git | 任意 | 版本控制 |

### 環境安裝

#### Windows 開發環境設置

```powershell
# 1. 安裝 Python 3.11+（從 python.org 下載）
# 安裝時勾選 "Add Python to PATH"

# 2. 安裝 Node.js 18+（從 nodejs.org 下載）

# 3. 確認安裝
python --version   # 應顯示 Python 3.11.x 或更高
node --version     # 應顯示 v18.x 或更高
npm --version      # 應顯示 9.x 或更高

# 4. 複製專案
git clone https://github.com/andylee303/jupyterlab-edu-extension.git
cd jupyterlab-edu-extension

# 5. 建立虛擬環境
python -m venv .venv
.\.venv\Scripts\activate

# 6. 設置環境變數
copy .env.example .env
# 編輯 .env 填入您的 API 金鑰

# 7. 安裝 Python 依賴（開發模式）
pip install -e ".[dev]"

# 8. 安裝 Node.js 依賴
npm install

# 9. 編譯 TypeScript 並建置擴展
npm run build

# 10. 啟動開發伺服器
jupyter lab
```

#### macOS/Linux 開發環境設置

```bash
# 1. 安裝 Python 3.11+
# macOS: brew install python@3.11
# Ubuntu: sudo apt install python3.11 python3.11-venv

# 2. 安裝 Node.js 18+
# macOS: brew install node
# Ubuntu: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install -y nodejs

# 3. 確認安裝
python3 --version
node --version
npm --version

# 4. 複製專案
git clone https://github.com/andylee303/jupyterlab-edu-extension.git
cd jupyterlab-edu-extension

# 5. 建立虛擬環境
python3 -m venv .venv
source .venv/bin/activate

# 6. 設置環境變數
cp .env.example .env
# 編輯 .env 填入您的 API 金鑰

# 7. 安裝 Python 依賴（開發模式）
pip install -e ".[dev]"

# 8. 安裝 Node.js 依賴
npm install

# 9. 編譯 TypeScript 並建置擴展
npm run build

# 10. 啟動開發伺服器
jupyter lab
```

### 開發工作流程

```bash
# 監看模式（自動重新編譯前端）
npm run watch

# 在另一個終端啟動 JupyterLab（自動重載）
jupyter lab --autoreload
```

### 程式碼結構說明

| 目錄 | 說明 |
|------|------|
| `src/` | TypeScript 前端原始碼 |
| `src/index.ts` | 擴展入口點 |
| `src/services/` | 前端服務（API 客戶端、Kernel 監聽） |
| `src/widgets/` | UI 組件（登入畫面、ChatGPT 側邊欄） |
| `jupyterlab_edu_extension/` | Python 後端 |
| `jupyterlab_edu_extension/handlers.py` | API 路由處理 |
| `jupyterlab_edu_extension/services/` | 後端服務（OpenAI、Supabase） |
| `style/` | CSS 樣式檔 |

### 建置指令

```bash
# 開發建置
npm run build

# 生產建置（含優化）
npm run build:prod

# 清理建置產物
npm run clean:all

# 程式碼檢查
npm run lint:check           # TypeScript
ruff check jupyterlab_edu_extension/  # Python
```

### 發布流程

```bash
# 1. 更新版本號（package.json 和 pyproject.toml）

# 2. 重新建置
npm run build:prod

# 3. 提交變更
git add .
git commit -m "release: v0.x.x"
git push origin main

# 4. （選配）發布到 PyPI
python -m build
twine upload dist/*
```

---

## 📁 專案結構

```
jupyterlab-edu-extension/
├── jupyterlab_edu_extension/   # Python 後端
│   ├── __init__.py             # 擴展入口
│   ├── handlers.py             # API 路由
│   ├── config.py               # 配置管理
│   └── services/               # 業務邏輯
│       ├── chatgpt_service.py  # OpenAI 整合
│       ├── supabase_client.py  # Supabase 整合
│       └── tracking_service.py # 追蹤服務
├── src/                        # TypeScript 前端
│   ├── index.ts                # 入口點
│   ├── services/               # 前端服務
│   │   ├── apiClient.ts        # API 客戶端
│   │   ├── kernelMonitor.ts    # Kernel 監聽
│   │   └── sessionManager.ts   # 會話管理
│   └── widgets/                # UI 組件
│       ├── LoginWidget.ts      # 登入介面
│       └── ChatGPTSidebarWidget.ts # AI 助教側邊欄
├── style/                      # CSS 樣式
├── scripts/                    # 安裝腳本
│   ├── install.ps1             # Windows 安裝
│   ├── install.sh              # macOS/Linux 安裝
│   ├── install_on_pi.sh        # 樹莓派安裝
│   └── supabase_setup.sql      # 資料庫設置
├── .env.example                # 環境變數範例
├── package.json                # npm 配置
├── pyproject.toml              # Python 專案配置
├── tsconfig.json               # TypeScript 配置
└── README.md                   # 本文件
```

---

## 🐛 常見問題

<details>
<summary><b>Q: 安裝時出現「找不到 Python」？</b></summary>

Windows 用戶請確認安裝 Python 時有勾選「Add Python to PATH」。如果沒有，請重新下載安裝 Python 並勾選此選項。

</details>

<details>
<summary><b>Q: 安裝時出現「pip 不是可執行的命令」？</b></summary>

嘗試使用 `python -m pip` 代替 `pip`：

```powershell
python -m pip install jupyterlab git+https://github.com/andylee303/jupyterlab-edu-extension.git
```

</details>

<details>
<summary><b>Q: 登入按鈕沒反應？</b></summary>

請按 `Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（macOS）強制重新整理瀏覽器。

</details>

<details>
<summary><b>Q: AI 助教沒有回應？</b></summary>

1. 確認已正確設定 OpenAI API Key
2. 確認 API Key 有效且有餘額
3. 檢查網路連線

</details>

<details>
<summary><b>Q: 樹莓派上無法遠端連線？</b></summary>

確認啟動指令包含 `--ip=0.0.0.0`：

```bash
jupyter lab --ip=0.0.0.0 --no-browser
```

並確認防火牆允許 8888 port。

</details>

<details>
<summary><b>Q: 開發時修改程式碼後沒有生效？</b></summary>

1. 確認已執行 `npm run build` 重新編譯
2. 使用 `jupyter lab --autoreload` 啟動
3. 按 `Ctrl+Shift+R` 強制重新整理瀏覽器

</details>

---

## 📝 授權

MIT License - 詳見 [LICENSE](LICENSE)

## 🙏 致謝

- [JupyterLab](https://jupyterlab.readthedocs.io/)
- [OpenAI](https://openai.com/)
- [Supabase](https://supabase.com/)
