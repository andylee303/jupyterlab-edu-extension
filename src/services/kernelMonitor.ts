/**
 * Kernel 監聯器
 *
 * 監聽 Notebook Kernel 的執行事件，追蹤程式執行結果
 */

import { NotebookPanel } from '@jupyterlab/notebook';
import { ISessionContext } from '@jupyterlab/apputils';
import { KernelMessage } from '@jupyterlab/services';

import { ApiClient, NotebookContext } from './api';
import { SessionManager } from './sessionManager';

/**
 * 執行結果介面
 */
interface ExecutionResult {
    cellId: string;
    cellContent: string;
    executionCount: number;
    outputs: string[];
    errors: string[];
    startTime: number;
    endTime: number;
}

/**
 * Kernel 監聽器類別
 */
export class KernelMonitor {
    private apiClient: ApiClient;

    // 每個 execution_request 的 MsgId 對應的執行結果
    private executionMap: Map<string, ExecutionResult> = new Map();

    // 追蹤已附加的 panel (避免對同一個 panel 重複 attach)
    private attachedPanels: Set<string> = new Set();

    // 追蹤每個 SessionContext 對應的 Kernel IOPub Handler
    // Key: Session ID, Value: Handler function
    private kernelHandlers: Map<string, (sender: any, msg: KernelMessage.IIOPubMessage) => void> = new Map();

    constructor(apiClient: ApiClient) {
        this.apiClient = apiClient;
    }

    /**
     * 附加到 Notebook
     */
    attachToNotebook(panel: NotebookPanel): void {
        const panelId = panel.id;
        if (this.attachedPanels.has(panelId)) {
            // 已經附加過這個 Panel，直接返回
            return;
        }
        this.attachedPanels.add(panelId);

        const sessionContext = panel.sessionContext;

        // 當 session 準備好時
        sessionContext.ready.then(() => {
            this.setupKernelListeners(sessionContext, panel.title.label);
        });

        // 當 kernel 變更時重新設置監聽器
        sessionContext.kernelChanged.connect(() => {
            this.setupKernelListeners(sessionContext, panel.title.label);
        });

        // 當 Panel 關閉時，清理資源（雖然 attachedPanels 不會移除，但 handler 會被 kernelChanged/session disposed 清理）
        panel.disposed.connect(() => {
            this.cleanupSession(sessionContext);
            this.attachedPanels.delete(panelId);
        });

        console.log('[KernelMonitor] 已附加到 Notebook:', panel.title.label);
    }

    /**
     * 清理 Session 相關監聽器
     */
    private cleanupSession(sessionContext: ISessionContext): void {
        const session = sessionContext.session;
        if (!session) return;

        // session.id 唯一標識這個會話
        const sessionId = session.id;
        const handler = this.kernelHandlers.get(sessionId);

        if (handler && session.kernel) {
            try {
                session.kernel.iopubMessage.disconnect(handler);
            } catch (e) {
                // 忽略斷開錯誤
            }
            this.kernelHandlers.delete(sessionId);
        }
    }

    /**
     * 設置 Kernel 監聽器
     */
    private setupKernelListeners(sessionContext: ISessionContext, notebookName: string): void {
        const session = sessionContext.session;
        const kernel = session?.kernel;

        if (!session || !kernel) {
            return;
        }

        // 先清理舊的監聽器（針對這個 Session）
        this.cleanupSession(sessionContext);

        // 建立新的處理器
        const handler = (_sender: any, msg: KernelMessage.IIOPubMessage) => {
            this.handleIOPubMessage(msg);
        };

        // 儲存並連接
        this.kernelHandlers.set(session.id, handler);
        kernel.iopubMessage.connect(handler);

        console.log(`[KernelMonitor] Kernel 監聽器已設置 (${notebookName})`);
    }

    /**
     * 處理 IOPub 訊息
     */
    private handleIOPubMessage(msg: KernelMessage.IIOPubMessage): void {
        const msgType = msg.header.msg_type;
        const parentMsgId = msg.parent_header?.msg_id as string;

        if (!parentMsgId) return;

        switch (msgType) {
            case 'execute_input':
                this.handleExecuteInput(parentMsgId, msg);
                break;
            case 'stream':
                this.handleStreamOutput(parentMsgId, msg);
                break;
            case 'execute_result':
                this.handleExecuteResult(parentMsgId, msg);
                break;
            case 'error':
                this.handleError(parentMsgId, msg);
                break;
            case 'status':
                this.handleStatus(parentMsgId, msg);
                break;
        }
    }

    /**
     * 處理執行輸入
     */
    private handleExecuteInput(
        parentMsgId: string,
        msg: KernelMessage.IIOPubMessage
    ): void {
        // 如果已經有這個 msgId (不應該發生，除非重複連接)，覆蓋它
        if (this.executionMap.has(parentMsgId)) {
            console.warn('[KernelMonitor] 重複的 execute_input，可能是重複監聽:', parentMsgId);
            return;
        }

        const content = msg.content as any;
        const executionCount = content.execution_count || 0;
        const code = content.code || '';

        this.executionMap.set(parentMsgId, {
            cellId: parentMsgId,
            cellContent: code,
            executionCount,
            outputs: [],
            errors: [],
            startTime: Date.now(),
            endTime: 0,
        });
    }

    /**
     * 處理串流輸出
     */
    private handleStreamOutput(
        parentMsgId: string,
        msg: KernelMessage.IIOPubMessage
    ): void {
        const result = this.executionMap.get(parentMsgId);
        if (!result) return;

        const content = msg.content as any;
        const text = content.text || '';
        result.outputs.push(text);
    }

    /**
     * 處理執行結果
     */
    private handleExecuteResult(
        parentMsgId: string,
        msg: KernelMessage.IIOPubMessage
    ): void {
        const result = this.executionMap.get(parentMsgId);
        if (!result) return;

        const content = msg.content as any;
        const data = content.data || {};

        // 取得文字輸出
        if (data['text/plain']) {
            result.outputs.push(data['text/plain']);
        }
    }

    /**
     * 處理錯誤
     */
    private handleError(
        parentMsgId: string,
        msg: KernelMessage.IIOPubMessage
    ): void {
        const result = this.executionMap.get(parentMsgId);
        if (!result) return;

        const content = msg.content as any;
        const ename = content.ename || 'Error';
        const evalue = content.evalue || '';
        const traceback = content.traceback || [];

        const errorText = `${ename}: ${evalue}\n${traceback.join('\n')}`;
        result.errors.push(errorText);
    }

    /**
     * 處理狀態變更
     */
    private async handleStatus(
        parentMsgId: string,
        msg: KernelMessage.IIOPubMessage
    ): Promise<void> {
        const content = msg.content as any;
        const executionState = content.execution_state;

        if (executionState === 'idle') {
            // 執行完成
            const result = this.executionMap.get(parentMsgId);
            if (result && result.cellContent) {
                // 重要：立即從 Map 移除，防止重複處理
                this.executionMap.delete(parentMsgId);

                result.endTime = Date.now();
                await this.recordExecution(result);
            }
        }
    }

    /**
     * 記錄執行結果
     */
    private async recordExecution(result: ExecutionResult): Promise<void> {
        // 只有登入時才記錄
        if (!SessionManager.isLoggedIn()) {
            return;
        }

        const sessionId = SessionManager.getSessionId();
        const executionTimeMs = result.endTime - result.startTime;
        const output = result.outputs.join('\n');
        const errorOutput =
            result.errors.length > 0 ? result.errors.join('\n') : null;

        try {
            const response = await this.apiClient.trackExecution({
                sessionId,
                cellId: result.cellId,
                cellContent: result.cellContent,
                executionCount: result.executionCount,
                output: output.slice(0, 10000), // 限制長度
                errorOutput: errorOutput ? errorOutput.slice(0, 5000) : null,
                executionTimeMs,
            });

            // 如果有 ChatGPT 分析且有錯誤，顯示分析結果
            if (response.chatgpt_analysis && errorOutput) {
                this.showAnalysisNotification(response.chatgpt_analysis);
            }
        } catch (error: any) {
            console.error('[KernelMonitor] 記錄執行失敗:', error);

            // 自動修復：如果 API 回傳未登入，但前端認為已登入，強制登出
            if (error.message && (error.message.includes('NOT_LOGGED_IN') || error.message.includes('請先登入'))) {
                console.warn('[KernelMonitor] 偵測到會話失效，執行自動登出');
                SessionManager.clearSession();

                // 顯示通知
                const event = new CustomEvent('edu-extension:require-login', {
                    detail: { message: '您的登入會話已過期，請重新登入。' },
                });
                document.dispatchEvent(event);
            }
        }
    }

    /**
     * 顯示分析通知
     */
    private showAnalysisNotification(analysis: string): void {
        // 發送自定義事件
        const event = new CustomEvent('edu-extension:analysis', {
            detail: { analysis },
        });
        document.dispatchEvent(event);
    }

    /**
     * 取得當前 Notebook 上下文
     */
    static getNotebookContext(panel: NotebookPanel): NotebookContext {
        const notebook = panel.content;
        const cells: NotebookContext['cells'] = [];

        for (let i = 0; i < notebook.widgets.length; i++) {
            const cell = notebook.widgets[i];
            const model = cell.model;

            cells.push({
                type: model.type === 'code' ? 'code' : 'markdown',
                content: model.sharedModel.getSource(),
            });
        }

        return {
            cells,
            current_cell_index: notebook.activeCellIndex,
        };
    }
}
