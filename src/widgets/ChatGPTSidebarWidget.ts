/**
 * ChatGPT 側邊欄 Widget（修正版）
 *
 * 支援登入驗證，使用穩定的非串流 API
 * 修正：使用靜態變數確保事件監聽器只註冊一次
 */

import { Widget } from '@lumino/widgets';
import { INotebookTracker } from '@jupyterlab/notebook';

import { ApiClient, NotebookContext } from '../services/api';
import { SessionManager } from '../services/sessionManager';
import { KernelMonitor } from '../services/kernelMonitor';

/**
 * 聊天訊息介面
 */
interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
}

/**
 * 全域事件處理器（確保只有一個）
 */
let analysisEventHandler: ((e: Event) => void) | null = null;
let currentChatWidget: ChatGPTSidebarWidget | null = null;

/**
 * ChatGPT 側邊欄 Widget 類別
 */
export class ChatGPTSidebarWidget extends Widget {
    private apiClient: ApiClient;
    private notebookTracker: INotebookTracker;
    public messages: ChatMessage[] = [];

    private messagesContainer: HTMLElement;
    private inputElement: HTMLTextAreaElement;
    private sendButton: HTMLButtonElement;
    private loginOverlay: HTMLElement;

    constructor(apiClient: ApiClient, notebookTracker: INotebookTracker) {
        super();
        this.apiClient = apiClient;
        this.notebookTracker = notebookTracker;

        this.addClass('jp-edu-chatgpt-sidebar');

        // 建立 UI
        this.node.innerHTML = `
      <div class="jp-edu-chat-container">
        <div class="jp-edu-chat-header">
          <h3>🤖 AI 助教</h3>
          <p class="jp-edu-chat-hint">有任何程式問題都可以問我！</p>
        </div>
        <div class="jp-edu-login-overlay">
          <div class="jp-edu-login-overlay-content">
            <p>🔒 請先登入以使用 AI 助教功能</p>
          </div>
        </div>
        <div class="jp-edu-chat-messages"></div>
        <div class="jp-edu-chat-input-area">
          <textarea 
            class="jp-edu-chat-input" 
            placeholder="輸入您的問題..."
            rows="3"
          ></textarea>
          <button class="jp-edu-chat-send">發送</button>
        </div>
      </div>
    `;

        // 取得 DOM 元素
        this.messagesContainer = this.node.querySelector('.jp-edu-chat-messages')!;
        this.inputElement = this.node.querySelector('.jp-edu-chat-input')!;
        this.sendButton = this.node.querySelector('.jp-edu-chat-send')!;
        this.loginOverlay = this.node.querySelector('.jp-edu-login-overlay')!;

        // 綁定事件
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 設定全域事件處理器（確保只有一個）
        this.setupGlobalAnalysisListener();

        // 監聽登入狀態變更
        SessionManager.subscribe((state) => {
            this.updateLoginState(state.isLoggedIn);
        });

        // 初始化登入狀態
        this.updateLoginState(SessionManager.isLoggedIn());

        // 添加歡迎訊息
        this.addMessage({
            role: 'assistant',
            content:
                '你好！我是你的 AI 助教 🎓\n\n我可以幫助你：\n- 解釋程式碼\n- 分析錯誤訊息\n- 回答程式設計問題\n\n有什麼可以幫助你的嗎？',
            timestamp: new Date(),
        });
    }

    /**
     * 設定全域分析事件監聽器（確保只有一個）
     */
    private setupGlobalAnalysisListener(): void {
        // 更新當前 Widget 引用
        currentChatWidget = this;

        // 如果已經有監聽器，不再添加
        if (analysisEventHandler) {
            console.log('[ChatGPTSidebar] 使用現有的全域事件監聯器');
            return;
        }

        // 建立全域事件處理器
        analysisEventHandler = (e: Event) => {
            const customEvent = e as CustomEvent<{ analysis: string }>;

            // 使用當前的 Widget 實例
            if (currentChatWidget && SessionManager.isLoggedIn()) {
                const analysis = customEvent.detail.analysis;
                const content = `📊 **程式執行分析**\n\n${analysis}`;

                // 檢查最後一條訊息是否為 system 類型（分析訊息）
                const lastMessage = currentChatWidget.messages[currentChatWidget.messages.length - 1];
                if (lastMessage && lastMessage.role === 'system' && lastMessage.content.includes('程式執行分析')) {
                    // 更新最後一條訊息
                    lastMessage.content = content;
                    currentChatWidget.updateLastMessage(content);
                } else {
                    // 添加新訊息
                    currentChatWidget.addMessage({
                        role: 'system',
                        content: content,
                        timestamp: new Date(),
                    });
                }
            }
        };

        document.addEventListener('edu-extension:analysis', analysisEventHandler);
        console.log('[ChatGPTSidebar] 全域事件監聽器已設置');
    }

    /**
     * 更新登入狀態 UI
     */
    private updateLoginState(isLoggedIn: boolean): void {
        if (isLoggedIn) {
            this.loginOverlay.style.display = 'none';
            this.inputElement.disabled = false;
            this.sendButton.disabled = false;
        } else {
            this.loginOverlay.style.display = 'flex';
            this.inputElement.disabled = true;
            this.sendButton.disabled = true;
        }
    }

    /**
     * 發送訊息
     */
    private async sendMessage(): Promise<void> {
        if (!SessionManager.isLoggedIn()) {
            return;
        }

        const message = this.inputElement.value.trim();
        if (!message) return;

        // 清空輸入框
        this.inputElement.value = '';

        // 添加用戶訊息
        this.addMessage({
            role: 'user',
            content: message,
            timestamp: new Date(),
        });

        // 顯示載入狀態
        this.setLoading(true);

        // 建立一個空的助手訊息，用於串流填充
        const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        };
        this.messages.push(assistantMessage);
        this.renderMessages();

        try {
            const notebookContext = this.getNotebookContext();
            const sessionId = SessionManager.getSessionId();

            // 使用串流 API
            await this.apiClient.chatStream(
                sessionId,
                message,
                notebookContext,
                // onChunk: 收到每個片段時更新訊息
                (chunk: string) => {
                    assistantMessage.content += chunk;
                    this.updateLastMessage(assistantMessage.content);
                },
                // onError: 發生錯誤時
                (error: string) => {
                    console.error('[ChatGPTSidebar] 串流錯誤:', error);
                    if (error === '請先登入') {
                        SessionManager.clearSession();
                        assistantMessage.content = '⚠️ 會話已過期，請重新登入。';
                    } else {
                        assistantMessage.content = `抱歉，發生錯誤：${error}\n\n請確認 OpenAI API 已正確配置。`;
                    }
                    this.updateLastMessage(assistantMessage.content);
                },
                // onComplete: 完成時
                () => {
                    if (!assistantMessage.content) {
                        assistantMessage.content = '無法取得回應，請稍後再試。';
                        this.updateLastMessage(assistantMessage.content);
                    }
                }
            );
        } catch (error: any) {
            console.error('[ChatGPTSidebar] 發送訊息失敗:', error);
            assistantMessage.content = `抱歉，發生錯誤：${error.message || error}`;
            this.updateLastMessage(assistantMessage.content);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * 添加訊息到聊天視窗
     */
    addMessage(message: ChatMessage): void {
        this.messages.push(message);

        const messageEl = document.createElement('div');
        messageEl.className = `jp-edu-chat-message jp-edu-chat-message-${message.role}`;

        const avatar =
            message.role === 'user'
                ? '👤'
                : message.role === 'assistant'
                    ? '🤖'
                    : '📢';
        const formattedContent = this.formatMarkdown(message.content);

        messageEl.innerHTML = `
      <div class="jp-edu-message-avatar">${avatar}</div>
      <div class="jp-edu-message-content">
        <div class="jp-edu-message-text">${formattedContent}</div>
        <div class="jp-edu-message-time">${this.formatTime(message.timestamp)}</div>
      </div>
    `;

        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
    }

    /**
     * 簡易 Markdown 格式化
     */
    private formatMarkdown(text: string): string {
        // 程式碼區塊
        text = text.replace(
            /```(\w+)?\n([\s\S]*?)```/g,
            '<pre><code>$2</code></pre>'
        );
        // 行內程式碼
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        // 粗體
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        // 斜體
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        // 換行
        text = text.replace(/\n/g, '<br>');
        // 標題
        text = text.replace(/^## (.+)$/gm, '<h4>$1</h4>');

        return text;
    }

    /**
     * 格式化時間
     */
    private formatTime(date: Date): string {
        return date.toLocaleTimeString('zh-TW', {
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /**
     * 重新渲染所有訊息
     */
    private renderMessages(): void {
        this.messagesContainer.innerHTML = '';
        for (const message of this.messages) {
            const messageEl = document.createElement('div');
            messageEl.className = `jp-edu-chat-message jp-edu-chat-message-${message.role}`;

            const avatar =
                message.role === 'user'
                    ? '👤'
                    : message.role === 'assistant'
                        ? '🤖'
                        : '📢';
            const formattedContent = this.formatMarkdown(message.content || '...');

            messageEl.innerHTML = `
        <div class="jp-edu-message-avatar">${avatar}</div>
        <div class="jp-edu-message-content">
          <div class="jp-edu-message-text">${formattedContent}</div>
          <div class="jp-edu-message-time">${this.formatTime(message.timestamp)}</div>
        </div>
      `;
            this.messagesContainer.appendChild(messageEl);
        }
        this.scrollToBottom();
    }

    /**
     * 更新最後一條訊息（用於串流更新）
     */
    public updateLastMessage(content: string): void {
        const lastMessageEl = this.messagesContainer.lastElementChild;
        if (lastMessageEl) {
            const textEl = lastMessageEl.querySelector('.jp-edu-message-text');
            if (textEl) {
                textEl.innerHTML = this.formatMarkdown(content);
            }
        }
        this.scrollToBottom();
    }

    /**
     * 捲動到底部
     */
    private scrollToBottom(): void {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * 設定載入狀態
     */
    private setLoading(loading: boolean): void {
        this.sendButton.disabled = loading;
        this.inputElement.disabled = loading;

        if (loading) {
            this.sendButton.textContent = '⏳';
        } else {
            this.sendButton.textContent = '發送';
        }
    }

    /**
     * 取得當前 Notebook 上下文
     */
    private getNotebookContext(): NotebookContext | undefined {
        const currentNotebook = this.notebookTracker.currentWidget;
        if (!currentNotebook) {
            return undefined;
        }

        return KernelMonitor.getNotebookContext(currentNotebook);
    }

    /**
     * 銷毀 Widget 時清理資源
     */
    dispose(): void {
        // 如果當前 Widget 是這個，清除引用
        if (currentChatWidget === this) {
            currentChatWidget = null;
        }
        super.dispose();
    }
}
