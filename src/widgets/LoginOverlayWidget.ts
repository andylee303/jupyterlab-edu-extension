/**
 * 登入覆蓋層 Widget
 *
 * 當用戶未登入時顯示全螢幕覆蓋層，阻止操作
 */

import { Widget } from '@lumino/widgets';
import { Dialog, showDialog } from '@jupyterlab/apputils';

import { SessionManager } from '../services/sessionManager';

/**
 * 登入覆蓋層 Widget 類別
 */
export class LoginOverlayWidget extends Widget {
    private overlay: HTMLElement | null = null;
    private warningShown: boolean = false;

    constructor() {
        super();

        // 建立覆蓋層
        this.createOverlay();

        // 監聽登入狀態變更
        SessionManager.subscribe((state) => {
            console.log('[LoginOverlay] 收到狀態變更:', state.isLoggedIn);
            this.updateOverlay(state.isLoggedIn);
        });

        // 監聽需要登入事件
        document.addEventListener('edu-extension:require-login', ((e: Event) => {
            const customEvent = e as CustomEvent<{ message: string }>;
            this.showLoginWarning(customEvent.detail.message);
        }) as EventListener);
    }

    /**
     * 建立覆蓋層
     */
    private createOverlay(): void {
        this.overlay = document.createElement('div');
        this.overlay.className = 'jp-edu-global-login-overlay';
        this.overlay.style.zIndex = '100000'; // 強制最高層級

        this.overlay.innerHTML = `
      <div class="jp-edu-overlay-content">
        <div class="jp-edu-overlay-icon">🔒</div>
        <h2>請先登入</h2>
        <p>您必須登入後才能使用 Jupyter Notebook</p>
        <button class="jp-edu-overlay-login-btn">📝 學生登入</button>
      </div>
    `;

        // 綁定登入按鈕
        const loginBtn = this.overlay.querySelector('.jp-edu-overlay-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                console.log('[LoginOverlay] 登入按鈕被點擊');
                // 觸發登入對話框
                const event = new CustomEvent('edu-extension:show-login');
                document.dispatchEvent(event);
            });
        }

        // 添加到 document body
        document.body.appendChild(this.overlay);

        // 初始狀態
        const isLoggedIn = SessionManager.isLoggedIn();
        console.log('[LoginOverlay] 初始化，當前登入狀態:', isLoggedIn);
        this.updateOverlay(isLoggedIn);
    }

    /**
     * 更新覆蓋層顯示
     */
    private updateOverlay(isLoggedIn: boolean): void {
        if (this.overlay) {
            const display = isLoggedIn ? 'none' : 'flex';
            this.overlay.style.display = display;
            console.log(`[LoginOverlay] 更新顯示: ${display} (已登入: ${isLoggedIn})`);
        } else {
            console.warn('[LoginOverlay] 覆蓋層元素不存在');
        }
    }

    /**
     * 顯示登入警告對話框
     */
    private async showLoginWarning(message: string): Promise<void> {
        // 避免重複顯示
        if (this.warningShown) {
            return;
        }
        this.warningShown = true;

        await showDialog({
            title: '⚠️ 請先登入',
            body: message || '您需要登入後才能執行程式碼。您的執行結果將不會被記錄。',
            buttons: [Dialog.okButton({ label: '我知道了' })],
        });

        this.warningShown = false;
    }

    /**
     * 銷毀覆蓋層
     */
    dispose(): void {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        super.dispose();
    }
}
