/**
 * 會話管理器
 *
 * 管理當前登入的學生會話狀態
 * 每次啟動時會清除舊的會話狀態，確保乾淨的開始
 */

/**
 * 學生資訊介面
 */
export interface StudentInfo {
    studentId: string;
    name: string;
}

/**
 * 會話狀態介面
 */
export interface SessionState {
    sessionId: string | null;
    student: StudentInfo | null;
    isLoggedIn: boolean;
    notebookName: string | null;
}

/**
 * 會話變更事件處理器
 */
type SessionChangeHandler = (state: SessionState) => void;

/**
 * 會話管理器（單例模式）
 */
export class SessionManager {
    private static state: SessionState = {
        sessionId: null,
        student: null,
        isLoggedIn: false,
        notebookName: null,
    };

    private static listeners: Set<SessionChangeHandler> = new Set();
    private static initialized: boolean = false;

    /**
     * 初始化會話管理器
     * 每次啟動時清除舊的會話狀態
     */
    static initialize(): void {
        if (this.initialized) {
            console.log('[SessionManager] 已經初始化過，跳過');
            return;
        }
        this.initialized = true;

        console.group('[SessionManager] 初始化');
        // 清除 localStorage 中的舊會話
        this.clearStorage();
        console.log('舊會話已清除');

        // 強制設置狀態為未登入
        this.state = {
            sessionId: null,
            student: null,
            isLoggedIn: false,
            notebookName: null,
        };
        console.log('狀態已重置為未登入:', this.state);
        console.groupEnd();

        // 重要：這會觸發所有監聽器，確保 UI 更新為未登入狀態
        this.notifyListeners();
    }

    /**
     * 取得當前會話 ID
     */
    static getSessionId(): string | null {
        return this.state.sessionId;
    }

    /**
     * 取得當前學生資訊
     */
    static getStudent(): StudentInfo | null {
        return this.state.student;
    }

    /**
     * 檢查是否已登入
     */
    static isLoggedIn(): boolean {
        return this.state.isLoggedIn;
    }

    /**
     * 取得完整會話狀態
     */
    static getState(): SessionState {
        return { ...this.state };
    }

    /**
     * 設定會話（登入成功後）
     */
    static setSession(
        sessionId: string,
        student: StudentInfo,
        notebookName: string
    ): void {
        console.group('[SessionManager] 設定會話 (setSession)');
        console.log('Session ID:', sessionId);
        console.log('Student:', student);
        console.trace('呼叫來源'); // 找出是誰呼叫的

        this.state = {
            sessionId,
            student,
            isLoggedIn: true,
            notebookName,
        };
        this.notifyListeners();
        console.groupEnd();
    }
    /**
     * 清除會話（登出）
     */
    static clearSession(): void {
        this.state = {
            sessionId: null,
            student: null,
            isLoggedIn: false,
            notebookName: null,
        };
        this.notifyListeners();
        this.clearStorage();
    }

    /**
     * 訂閱會話狀態變更
     */
    static subscribe(handler: SessionChangeHandler): () => void {
        this.listeners.add(handler);
        // 立即通知當前狀態
        handler(this.getState());
        // 返回取消訂閱函數
        return () => {
            this.listeners.delete(handler);
        };
    }

    /**
     * 通知所有監聯器
     */
    private static notifyListeners(): void {
        const state = this.getState();
        this.listeners.forEach((handler) => handler(state));

        // 發送自定義事件
        const event = new CustomEvent('edu-extension:session-change', {
            detail: state,
        });
        document.dispatchEvent(event);
    }

    /**
     * 從 localStorage 清除
     */
    private static clearStorage(): void {
        try {
            localStorage.removeItem('edu-extension-session');
        } catch (e) {
            console.warn('[SessionManager] 無法清除 localStorage:', e);
        }
    }

    /**
     * 檢查登入狀態並在未登入時顯示警告
     * 返回 true 如果已登入，否則顯示警告並返回 false
     */
    static requireLogin(showAlert: boolean = true): boolean {
        if (this.isLoggedIn()) {
            return true;
        }

        if (showAlert) {
            // 發送需要登入的事件
            const event = new CustomEvent('edu-extension:require-login', {
                detail: { message: '請先登入以執行程式碼' },
            });
            document.dispatchEvent(event);
        }

        return false;
    }
}
