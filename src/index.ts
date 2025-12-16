/**
 * JupyterLab 教學擴展 - 前端入口點
 *
 * 匯出所有 JupyterLab plugins
 */

import {
    JupyterFrontEnd,
    JupyterFrontEndPlugin
} from '@jupyterlab/application';
import { ICommandPalette } from '@jupyterlab/apputils';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';

import { ChatGPTSidebarWidget } from './widgets/ChatGPTSidebarWidget';
import { StudentLoginWidget } from './widgets/StudentLoginWidget';
import { LoginOverlayWidget } from './widgets/LoginOverlayWidget';
import { KernelMonitor } from './services/kernelMonitor';
import { ApiClient } from './services/api';
import { SessionManager } from './services/sessionManager';

import '../style/base.css';

/**
 * 擴展 ID 常數
 */
const EXTENSION_ID = 'jupyterlab-edu-extension';

/**
 * 命令 ID
 */
const CommandIds = {
    openChatGPT: `${EXTENSION_ID}:open-chatgpt`,
    showLogin: `${EXTENSION_ID}:show-login`,
    showReport: `${EXTENSION_ID}:show-report`,
};

/**
 * 主要擴展 Plugin
 */
const mainPlugin: JupyterFrontEndPlugin<void> = {
    id: `${EXTENSION_ID}:main`,
    autoStart: true,
    requires: [INotebookTracker],
    optional: [ICommandPalette],
    activate: async (
        app: JupyterFrontEnd,
        notebookTracker: INotebookTracker,
        palette: ICommandPalette | null
    ) => {
        console.log('[教學擴展] 正在啟動...');

        // 初始化 API 客戶端
        const apiClient = new ApiClient();

        // 初始化 SessionManager（清除舊會話，確保乾淨開始）
        // 這會廣播一個「未登入」的狀態變更事件
        SessionManager.initialize();

        // 檢查服務狀態
        try {
            const health = await apiClient.healthCheck();
            console.log('[教學擴展] 服務狀態:', health);
        } catch (error) {
            console.warn('[教學擴展] 無法連接後端服務:', error);
        }

        // 建立學生登入 Widget
        const loginWidget = new StudentLoginWidget(apiClient, notebookTracker);
        loginWidget.id = `${EXTENSION_ID}-login`;
        loginWidget.title.label = '學生登入';
        loginWidget.title.closable = false;

        // 建立全域登入覆蓋層，並保持引用以防止被 GC
        const loginOverlay = new LoginOverlayWidget();
        console.log('[教學擴展] LoginOverlay initialized:', loginOverlay);

        // 監聽登入對話框事件
        document.addEventListener('edu-extension:show-login', () => {
            loginWidget.showLoginDialog();
        });

        // 初始化 Kernel 監聽器
        const kernelMonitor = new KernelMonitor(apiClient);

        // 當 notebook 開啟時，附加監聽器
        notebookTracker.widgetAdded.connect((_sender: any, panel: NotebookPanel) => {
            kernelMonitor.attachToNotebook(panel);
        });

        // 建立 ChatGPT 側邊欄 Widget
        const chatWidget = new ChatGPTSidebarWidget(apiClient, notebookTracker);
        chatWidget.id = `${EXTENSION_ID}-chatgpt`;
        chatWidget.title.label = '💬 AI 助教';
        chatWidget.title.closable = true;

        // 註冊命令
        app.commands.addCommand(CommandIds.openChatGPT, {
            label: '開啟 AI 助教',
            caption: '開啟 ChatGPT 側邊欄',
            execute: () => {
                if (!chatWidget.isAttached) {
                    app.shell.add(chatWidget, 'right');
                }
                app.shell.activateById(chatWidget.id);
            },
        });

        app.commands.addCommand(CommandIds.showLogin, {
            label: '學生登入',
            caption: '顯示學生登入對話框',
            execute: () => {
                loginWidget.showLoginDialog();
            },
        });

        // 添加到命令面板
        if (palette) {
            palette.addItem({
                command: CommandIds.openChatGPT,
                category: '教學擴展',
            });
            palette.addItem({
                command: CommandIds.showLogin,
                category: '教學擴展',
            });
        }

        // 將登入 Widget 添加到頂部工具列
        app.shell.add(loginWidget, 'top');

        // 預設開啟 ChatGPT 側邊欄
        app.shell.add(chatWidget, 'right');

        console.log('[教學擴展] 啟動完成');
    },
};

/**
 * 匯出所有 plugins
 */
const plugins: JupyterFrontEndPlugin<any>[] = [mainPlugin];

export default plugins;
