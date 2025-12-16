/**
 * API 客戶端（優化版）
 *
 * 支援串流回應與登入驗證
 */

import { URLExt } from '@jupyterlab/coreutils';
import { ServerConnection } from '@jupyterlab/services';

/**
 * API 回應介面
 */
interface ApiResponse<T = any> {
    success: boolean;
    error?: string;
    error_code?: string;
    mode?: 'local' | 'cloud';
    [key: string]: T | boolean | string | undefined;
}

/**
 * 登入回應
 */
export interface LoginResponse extends ApiResponse {
    session_id?: string;
    message?: string;
    student?: {
        student_id: string;
        name: string;
    };
}

/**
 * 執行追蹤回應
 */
export interface TrackingResponse extends ApiResponse {
    log_id?: string;
    chatgpt_analysis?: string;
}

/**
 * ChatGPT 回應
 */
export interface ChatGPTResponse extends ApiResponse {
    response?: string;
    analysis?: string;
}

/**
 * 分析報告
 */
export interface AnalyticsReport {
    execution_summary: {
        total_executions: number;
        successful_executions: number;
        failed_executions: number;
        success_rate: number;
    };
    error_distribution: Array<{
        error_type: string;
        count: number;
    }>;
    time_analysis: {
        total_time_ms: number;
        avg_time_ms: number;
        max_time_ms: number;
        cell_times: Array<{
            cell_id: string;
            avg_time_ms: number;
            execution_count: number;
        }>;
    };
    activity_heatmap: Array<{
        hour: number;
        minute_block: number;
        count: number;
    }>;
    cell_analysis: Array<{
        cell_id: string;
        execution_count: number;
        error_count: number;
        first_execution: string;
        last_execution: string;
    }>;
}

/**
 * Notebook 上下文
 */
export interface NotebookContext {
    cells: Array<{
        type: 'code' | 'markdown';
        content: string;
    }>;
    current_cell_index: number;
}

/**
 * 串流回調函數
 */
export type StreamCallback = (chunk: string) => void;

/**
 * API 客戶端類別
 */
export class ApiClient {
    private readonly serverSettings: ServerConnection.ISettings;
    private readonly baseUrl: string;

    constructor() {
        this.serverSettings = ServerConnection.makeSettings();
        this.baseUrl = URLExt.join(this.serverSettings.baseUrl, 'edu-extension', 'api');
    }

    /**
     * 發送 API 請求
     */
    private async request<T>(
        endpoint: string,
        method: 'GET' | 'POST' = 'GET',
        body?: object
    ): Promise<T> {
        const url = URLExt.join(this.baseUrl, endpoint);
        const init: RequestInit = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (body) {
            init.body = JSON.stringify(body);
        }

        const response = await ServerConnection.makeRequest(url, init, this.serverSettings);

        if (!response.ok) {
            const text = await response.text();
            try {
                const json = JSON.parse(text);
                if (json.error_code === 'NOT_LOGGED_IN') {
                    throw new Error('請先登入');
                }
                throw new Error(json.error || `API 請求失敗: ${response.status}`);
            } catch (e) {
                if (e instanceof Error && e.message === '請先登入') throw e;
                throw new Error(`API 請求失敗: ${response.status} ${text}`);
            }
        }

        return response.json();
    }

    /**
     * 健康檢查
     */
    async healthCheck(): Promise<{
        status: string;
        supabase_configured: boolean;
        openai_configured: boolean;
    }> {
        return this.request('health');
    }

    /**
     * 檢查登入狀態
     */
    async checkLogin(sessionId: string): Promise<{
        logged_in: boolean;
        student_id?: string;
        name?: string;
    }> {
        return this.request(`auth/check?session_id=${encodeURIComponent(sessionId)}`);
    }

    /**
     * 學生登入
     */
    async login(
        studentId: string,
        name: string,
        notebookName: string
    ): Promise<LoginResponse> {
        return this.request('auth/login', 'POST', {
            student_id: studentId,
            name: name,
            notebook_name: notebookName,
        });
    }

    /**
     * 學生登出
     */
    async logout(sessionId: string): Promise<ApiResponse> {
        return this.request('auth/logout', 'POST', {
            session_id: sessionId,
        });
    }

    /**
     * 記錄程式執行
     */
    async trackExecution(params: {
        sessionId: string | null;
        cellId: string;
        cellContent: string;
        executionCount: number;
        output: string;
        errorOutput: string | null;
        executionTimeMs: number;
    }): Promise<TrackingResponse> {
        return this.request('tracking/execution', 'POST', {
            session_id: params.sessionId,
            cell_id: params.cellId,
            cell_content: params.cellContent,
            execution_count: params.executionCount,
            output: params.output,
            error_output: params.errorOutput,
            execution_time_ms: params.executionTimeMs,
        });
    }

    /**
     * 分析程式碼/錯誤
     */
    async analyzeCode(
        sessionId: string | null,
        code: string,
        error?: string,
        context?: string
    ): Promise<ChatGPTResponse> {
        return this.request('chatgpt/analyze', 'POST', {
            session_id: sessionId,
            code,
            error,
            context,
        });
    }

    /**
     * ChatGPT 對話（非串流）
     */
    async chat(
        sessionId: string | null,
        message: string,
        notebookContext?: NotebookContext
    ): Promise<ChatGPTResponse> {
        return this.request('chatgpt/chat', 'POST', {
            session_id: sessionId,
            message,
            notebook_context: notebookContext,
        });
    }

    /**
     * ChatGPT 對話（串流）
     */
    async chatStream(
        sessionId: string | null,
        message: string,
        notebookContext: NotebookContext | undefined,
        onChunk: StreamCallback,
        onError?: (error: string) => void,
        onComplete?: () => void
    ): Promise<void> {
        const url = URLExt.join(this.baseUrl, 'chatgpt/stream');

        try {
            // 取得 XSRF token
            const xsrfToken = document.cookie
                .split('; ')
                .find(row => row.startsWith('_xsrf='))
                ?.split('=')[1] || '';

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRFToken': xsrfToken,
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    message,
                    notebook_context: notebookContext,
                }),
                credentials: 'same-origin',
            });

            if (!response.ok) {
                const text = await response.text();
                try {
                    const json = JSON.parse(text);
                    if (json.error_code === 'NOT_LOGGED_IN') {
                        onError?.('請先登入');
                        return;
                    }
                    onError?.(json.error || '請求失敗');
                } catch {
                    onError?.(`請求失敗: ${response.status}`);
                }
                return;
            }

            const reader = response.body?.getReader();
            if (!reader) {
                onError?.('無法讀取串流');
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') {
                            onComplete?.();
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.chunk) {
                                onChunk(parsed.chunk);
                            } else if (parsed.error) {
                                onError?.(parsed.error);
                            }
                        } catch {
                            // 忽略解析錯誤
                        }
                    }
                }
            }

            onComplete?.();
        } catch (error) {
            onError?.(`網路錯誤: ${error}`);
        }
    }

    /**
     * 取得學習報告
     */
    async getReport(sessionId: string): Promise<{
        success: boolean;
        report: AnalyticsReport;
        mode?: string;
    }> {
        return this.request(`analytics/report?session_id=${encodeURIComponent(sessionId)}`);
    }
}
