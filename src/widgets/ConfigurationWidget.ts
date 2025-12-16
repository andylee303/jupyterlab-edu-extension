/**
 * 配置設定 Widget
 *
 * 讓用戶在 JupyterLab 介面中設定 API Key 等配置
 */

import { Widget } from '@lumino/widgets';
import { Dialog, showDialog } from '@jupyterlab/apputils';

/**
 * 配置設定對話框
 */
export class ConfigurationWidget {
    /**
     * 顯示配置對話框
     */
    static async showConfigDialog(): Promise<boolean> {
        const body = document.createElement('div');
        body.className = 'jp-edu-config-dialog';
        body.innerHTML = `
            <div class="jp-edu-config-section">
                <h4>🔑 OpenAI 設定（必要）</h4>
                <p class="jp-edu-config-hint">用於 AI 助教功能。前往 <a href="https://platform.openai.com" target="_blank">platform.openai.com</a> 取得 API Key。</p>
                <div class="jp-edu-form-group">
                    <label for="openai-key">OpenAI API Key *</label>
                    <input type="password" id="openai-key" placeholder="sk-..." autocomplete="off" />
                </div>
                <div class="jp-edu-form-group">
                    <label for="openai-model">模型</label>
                    <select id="openai-model">
                        <option value="gpt-4o-mini" selected>gpt-4o-mini（推薦，較便宜）</option>
                        <option value="gpt-4o">gpt-4o（較強，較貴）</option>
                        <option value="gpt-3.5-turbo">gpt-3.5-turbo（舊版）</option>
                    </select>
                </div>
            </div>
            
            <div class="jp-edu-config-section">
                <h4>☁️ Supabase 設定（選填）</h4>
                <p class="jp-edu-config-hint">用於雲端儲存學習紀錄。若不設定，資料僅存於本機。</p>
                <div class="jp-edu-form-group">
                    <label for="supabase-url">Supabase URL</label>
                    <input type="text" id="supabase-url" placeholder="https://xxx.supabase.co" autocomplete="off" />
                </div>
                <div class="jp-edu-form-group">
                    <label for="supabase-key">Supabase Anon Key</label>
                    <input type="password" id="supabase-key" placeholder="eyJ..." autocomplete="off" />
                </div>
            </div>
        `;

        const result = await showDialog({
            title: '⚙️ 教學擴展設定',
            body: new Widget({ node: body }),
            buttons: [
                Dialog.cancelButton({ label: '稍後設定' }),
                Dialog.okButton({ label: '儲存設定' }),
            ],
        });

        if (result.button.accept) {
            const openaiKey = (body.querySelector('#openai-key') as HTMLInputElement).value.trim();
            const openaiModel = (body.querySelector('#openai-model') as HTMLSelectElement).value;
            const supabaseUrl = (body.querySelector('#supabase-url') as HTMLInputElement).value.trim();
            const supabaseKey = (body.querySelector('#supabase-key') as HTMLInputElement).value.trim();

            if (!openaiKey) {
                await showDialog({
                    title: '錯誤',
                    body: 'OpenAI API Key 為必填欄位',
                    buttons: [Dialog.okButton({ label: '確定' })],
                });
                return false;
            }

            // 儲存到後端
            try {
                const response = await fetch('/edu-extension/api/config/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        openai_api_key: openaiKey,
                        openai_model: openaiModel,
                        supabase_url: supabaseUrl,
                        supabase_anon_key: supabaseKey,
                    }),
                });

                if (response.ok) {
                    await showDialog({
                        title: '成功',
                        body: '設定已儲存！請重新整理頁面以載入新設定。',
                        buttons: [Dialog.okButton({ label: '確定' })],
                    });
                    return true;
                } else {
                    throw new Error('儲存失敗');
                }
            } catch (error) {
                await showDialog({
                    title: '錯誤',
                    body: '無法儲存設定，請確認後端服務正常運作。',
                    buttons: [Dialog.okButton({ label: '確定' })],
                });
                return false;
            }
        }

        return false;
    }

    /**
     * 檢查是否需要顯示配置對話框
     */
    static async checkAndPromptConfig(): Promise<void> {
        try {
            const response = await fetch('/edu-extension/api/health');
            const data = await response.json();

            if (!data.openai_configured) {
                console.log('[Configuration] OpenAI 未設定，顯示配置對話框');
                await this.showConfigDialog();
            }
        } catch (error) {
            console.error('[Configuration] 無法檢查配置狀態:', error);
        }
    }
}
