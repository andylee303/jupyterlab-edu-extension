/**
 * 學生登入 Widget
 *
 * 顯示在 JupyterLab 頂部的登入區塊
 */

import { Widget } from '@lumino/widgets';
import { Dialog, showDialog } from '@jupyterlab/apputils';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ApiClient } from '../services/api';
import { SessionManager, SessionState } from '../services/sessionManager';

/**
 * 學生登入 Widget 類別
 */
export class StudentLoginWidget extends Widget {
    private apiClient: ApiClient;
    private notebookTracker: INotebookTracker;
    private statusElement: HTMLElement;

    constructor(apiClient: ApiClient, notebookTracker: INotebookTracker) {
        super();
        this.apiClient = apiClient;
        this.notebookTracker = notebookTracker;

        this.addClass('jp-edu-login-widget');

        // 建立 UI
        this.statusElement = document.createElement('div');
        this.statusElement.className = 'jp-edu-login-status';
        this.node.appendChild(this.statusElement);

        // 訂閱會話狀態變更
        SessionManager.subscribe(state => this.updateUI(state));

        // 初始化 UI
        this.updateUI(SessionManager.getState());
    }

    /**
     * 更新 UI 顯示
     */
    private updateUI(state: SessionState): void {
        if (state.isLoggedIn && state.student) {
            this.statusElement.innerHTML = `
        <span class="jp-edu-student-info">
          👤 ${state.student.name} (${state.student.studentId})
        </span>
        <button class="jp-edu-logout-btn" title="登出">登出</button>
        <button class="jp-edu-config-btn" title="擴展設定">⚙️</button>
      `;

            // 綁定登出按鈕事件
            const logoutBtn = this.statusElement.querySelector('.jp-edu-logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => this.handleLogout());
            }

            // 綁定設定按鈕事件
            const configBtn = this.statusElement.querySelector('.jp-edu-config-btn');
            if (configBtn) {
                configBtn.addEventListener('click', async () => {
                    const { ConfigurationWidget } = await import('./ConfigurationWidget');
                    ConfigurationWidget.showConfigDialog();
                });
            }
        } else {
            this.statusElement.innerHTML = `
        <button class="jp-edu-login-btn">📝 學生登入</button>
        <button class="jp-edu-config-btn" title="擴展設定">⚙️</button>
      `;

            // 綁定登入按鈕事件
            const loginBtn = this.statusElement.querySelector('.jp-edu-login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => this.showLoginDialog());
            }

            // 綁定設定按鈕事件
            const configBtn = this.statusElement.querySelector('.jp-edu-config-btn');
            if (configBtn) {
                configBtn.addEventListener('click', async () => {
                    const { ConfigurationWidget } = await import('./ConfigurationWidget');
                    ConfigurationWidget.showConfigDialog();
                });
            }
        }
    }

    /**
     * 顯示登入對話框
     */
    async showLoginDialog(): Promise<void> {
        console.log('[StudentLoginWidget] showLoginDialog 被呼叫');

        // 暫時隱藏全域覆蓋層，讓對話框可以顯示
        const overlay = document.querySelector('.jp-edu-global-login-overlay') as HTMLElement;
        if (overlay) {
            overlay.style.display = 'none';
        }

        // 建立對話框內容
        const body = document.createElement('div');
        body.className = 'jp-edu-login-dialog';
        body.innerHTML = `
      <div class="jp-edu-form-group">
        <label for="student-id">學號 *</label>
        <input type="text" id="student-id" placeholder="請輸入學號" autocomplete="off" />
      </div>
      <div class="jp-edu-form-group">
        <label for="student-name">姓名 *</label>
        <input type="text" id="student-name" placeholder="請輸入姓名" autocomplete="off" />
      </div>
      <p class="jp-edu-form-note">登入後將開始記錄您的學習歷程</p>
    `;

        try {
            const result = await showDialog({
                title: '學生登入',
                body: new Widget({ node: body }),
                buttons: [
                    Dialog.cancelButton({ label: '取消' }),
                    Dialog.okButton({ label: '登入' }),
                ],
            });

            if (result.button.accept) {
                const studentIdInput = body.querySelector('#student-id') as HTMLInputElement;
                const nameInput = body.querySelector('#student-name') as HTMLInputElement;

                const studentId = studentIdInput?.value.trim() || '';
                const name = nameInput?.value.trim() || '';

                if (studentId && name) {
                    await this.handleLogin(studentId, name);
                } else {
                    await showDialog({
                        title: '錯誤',
                        body: '學號和姓名為必填欄位',
                        buttons: [Dialog.okButton({ label: '確定' })],
                    });
                }
            }
        } finally {
            // 對話框關閉後，根據登入狀態決定是否恢復覆蓋層
            if (overlay && !SessionManager.isLoggedIn()) {
                overlay.style.display = 'flex';
            }
        }
    }

    /**
     * 處理登入
     */
    private async handleLogin(studentId: string, name: string): Promise<void> {
        // 取得當前 Notebook 名稱
        const currentNotebook = this.notebookTracker.currentWidget;
        const notebookName = currentNotebook?.title.label || 'unknown';

        try {
            const response = await this.apiClient.login(studentId, name, notebookName);

            if (response.success && response.session_id) {
                SessionManager.setSession(
                    response.session_id,
                    { studentId, name },
                    notebookName
                );

                await showDialog({
                    title: '登入成功',
                    body: response.message || '歡迎！您的學習歷程將被記錄。',
                    buttons: [Dialog.okButton({ label: '開始學習' })],
                });
            } else {
                throw new Error(response.error || '登入失敗');
            }
        } catch (error) {
            console.error('[StudentLoginWidget] 登入錯誤:', error);
            await showDialog({
                title: '登入失敗',
                body: `${error}`,
                buttons: [Dialog.okButton({ label: '確定' })],
            });
        }
    }

    /**
     * 處理登出
     */
    private async handleLogout(): Promise<void> {
        const sessionId = SessionManager.getSessionId();

        const result = await showDialog({
            title: '確認登出',
            body: '確定要登出嗎？',
            buttons: [
                Dialog.cancelButton({ label: '取消' }),
                Dialog.okButton({ label: '登出' }),
            ],
        });

        if (result.button.accept) {
            try {
                if (sessionId) {
                    await this.apiClient.logout(sessionId);
                }
                SessionManager.clearSession();
            } catch (error) {
                console.error('[StudentLoginWidget] 登出錯誤:', error);
                // 即使 API 失敗也清除本地狀態
                SessionManager.clearSession();
            }
        }
    }
}
