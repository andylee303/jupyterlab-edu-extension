/**
 * 反思報告 Widget
 *
 * 顯示學習分析視覺化報告
 */

import { Widget } from '@lumino/widgets';

import { ApiClient, AnalyticsReport } from '../services/api';
import { SessionManager } from '../services/sessionManager';

// 宣告 Plotly 全域變數
declare const Plotly: any;

/**
 * 反思報告 Widget 類別
 */
export class ReflectionReportWidget extends Widget {
    private apiClient: ApiClient;
    private chartContainer: HTMLElement;
    private summaryContainer: HTMLElement;
    private loadingElement: HTMLElement;

    constructor(apiClient: ApiClient) {
        super();
        this.apiClient = apiClient;

        this.addClass('jp-edu-reflection-report');

        // 建立 UI
        this.node.innerHTML = `
      <div class="jp-edu-report-container">
        <h2>📊 學習反思報告</h2>
        <div class="jp-edu-report-loading">
          <span>載入中...</span>
        </div>
        <div class="jp-edu-report-summary"></div>
        <div class="jp-edu-report-charts">
          <div class="jp-edu-chart" id="execution-pie-chart"></div>
          <div class="jp-edu-chart" id="error-bar-chart"></div>
          <div class="jp-edu-chart" id="time-bar-chart"></div>
          <div class="jp-edu-chart" id="activity-heatmap"></div>
        </div>
      </div>
    `;

        this.chartContainer = this.node.querySelector('.jp-edu-report-charts')!;
        this.summaryContainer = this.node.querySelector('.jp-edu-report-summary')!;
        this.loadingElement = this.node.querySelector('.jp-edu-report-loading')!;

        // 載入報告
        this.loadReport();
    }

    /**
     * 載入報告資料
     */
    async loadReport(): Promise<void> {
        const sessionId = SessionManager.getSessionId();
        if (!sessionId) {
            this.showMessage('請先登入以查看學習報告');
            return;
        }

        try {
            this.loadingElement.style.display = 'block';
            this.chartContainer.style.display = 'none';

            const response = await this.apiClient.getReport(sessionId);

            if (response.success && response.report) {
                this.renderReport(response.report);
            } else {
                this.showMessage('無法載入報告資料');
            }
        } catch (error) {
            console.error('[ReflectionReport] 載入報告失敗:', error);
            this.showMessage('載入報告時發生錯誤');
        } finally {
            this.loadingElement.style.display = 'none';
        }
    }

    /**
     * 渲染報告
     */
    private renderReport(report: AnalyticsReport): void {
        this.chartContainer.style.display = 'grid';

        // 渲染摘要
        this.renderSummary(report);

        // 渲染圖表
        this.renderExecutionPieChart(report.execution_summary);
        this.renderErrorBarChart(report.error_distribution);
        this.renderTimeBarChart(report.time_analysis);
        this.renderActivityHeatmap(report.activity_heatmap);
    }

    /**
     * 渲染摘要統計
     */
    private renderSummary(report: AnalyticsReport): void {
        const summary = report.execution_summary;
        const insights = this.generateInsights(report);

        this.summaryContainer.innerHTML = `
      <div class="jp-edu-summary-cards">
        <div class="jp-edu-summary-card">
          <div class="jp-edu-summary-value">${summary.total_executions}</div>
          <div class="jp-edu-summary-label">總執行次數</div>
        </div>
        <div class="jp-edu-summary-card jp-edu-success">
          <div class="jp-edu-summary-value">${summary.successful_executions}</div>
          <div class="jp-edu-summary-label">成功執行</div>
        </div>
        <div class="jp-edu-summary-card jp-edu-error">
          <div class="jp-edu-summary-value">${summary.failed_executions}</div>
          <div class="jp-edu-summary-label">失敗執行</div>
        </div>
        <div class="jp-edu-summary-card">
          <div class="jp-edu-summary-value">${summary.success_rate}%</div>
          <div class="jp-edu-summary-label">成功率</div>
        </div>
      </div>
      <div class="jp-edu-insights">
        <h4>💡 學習洞察</h4>
        <ul>
          ${insights.map(i => `<li>${i}</li>`).join('')}
        </ul>
      </div>
    `;
    }

    /**
     * 產生學習洞察
     */
    private generateInsights(report: AnalyticsReport): string[] {
        const insights: string[] = [];
        const summary = report.execution_summary;

        // 成功率洞察
        if (summary.success_rate >= 80) {
            insights.push('🎉 太棒了！你的程式執行成功率很高，繼續保持！');
        } else if (summary.success_rate >= 50) {
            insights.push('💪 不錯的表現！多練習可以進一步提高成功率。');
        } else if (summary.total_executions > 0) {
            insights.push('📚 遇到困難是學習的一部分，試著理解每個錯誤訊息的含義。');
        }

        // 錯誤類型洞察
        if (report.error_distribution.length > 0) {
            const topError = report.error_distribution[0];
            insights.push(
                `⚠️ 最常見的錯誤是 ${topError.error_type}（${topError.count} 次），` +
                '可以特別注意這類問題。'
            );
        }

        // 時間洞察
        if (report.time_analysis.avg_time_ms > 1000) {
            insights.push('⏱️ 平均執行時間較長，可以考慮優化程式效能。');
        }

        // 活動洞察
        if (report.activity_heatmap.length > 0) {
            const peakHour = report.activity_heatmap.reduce(
                (max, item) => (item.count > max.count ? item : max),
                report.activity_heatmap[0]
            );
            insights.push(`🕐 你最活躍的時段是 ${peakHour.hour}:${peakHour.minute_block.toString().padStart(2, '0')}。`);
        }

        if (insights.length === 0) {
            insights.push('開始執行程式碼後，這裡將顯示你的學習洞察。');
        }

        return insights;
    }

    /**
     * 渲染執行結果圓餅圖
     */
    private renderExecutionPieChart(summary: AnalyticsReport['execution_summary']): void {
        const container = this.node.querySelector('#execution-pie-chart');
        if (!container || typeof Plotly === 'undefined') return;

        const data = [{
            values: [summary.successful_executions, summary.failed_executions],
            labels: ['成功', '失敗'],
            type: 'pie',
            marker: {
                colors: ['#4CAF50', '#f44336'],
            },
            textinfo: 'label+percent',
            hole: 0.4,
        }];

        const layout = {
            title: '執行成功/失敗比例',
            height: 300,
            margin: { t: 40, b: 20, l: 20, r: 20 },
        };

        Plotly.newPlot(container, data, layout, { responsive: true });
    }

    /**
     * 渲染錯誤類型長條圖
     */
    private renderErrorBarChart(distribution: AnalyticsReport['error_distribution']): void {
        const container = this.node.querySelector('#error-bar-chart');
        if (!container || typeof Plotly === 'undefined' || distribution.length === 0) return;

        const data = [{
            x: distribution.map(d => d.error_type),
            y: distribution.map(d => d.count),
            type: 'bar',
            marker: {
                color: '#ff7043',
            },
        }];

        const layout = {
            title: '錯誤類型分佈',
            height: 300,
            margin: { t: 40, b: 80, l: 40, r: 20 },
            xaxis: {
                tickangle: -45,
            },
        };

        Plotly.newPlot(container, data, layout, { responsive: true });
    }

    /**
     * 渲染執行時間長條圖
     */
    private renderTimeBarChart(analysis: AnalyticsReport['time_analysis']): void {
        const container = this.node.querySelector('#time-bar-chart');
        if (!container || typeof Plotly === 'undefined' || analysis.cell_times.length === 0) return;

        const sortedCells = [...analysis.cell_times]
            .sort((a, b) => b.avg_time_ms - a.avg_time_ms)
            .slice(0, 10);

        const data = [{
            x: sortedCells.map((_, i) => `Cell ${i + 1}`),
            y: sortedCells.map(d => d.avg_time_ms),
            type: 'bar',
            marker: {
                color: '#42a5f5',
            },
        }];

        const layout = {
            title: '各 Cell 平均執行時間 (ms)',
            height: 300,
            margin: { t: 40, b: 60, l: 60, r: 20 },
        };

        Plotly.newPlot(container, data, layout, { responsive: true });
    }

    /**
     * 渲染活動熱力圖
     */
    private renderActivityHeatmap(heatmapData: AnalyticsReport['activity_heatmap']): void {
        const container = this.node.querySelector('#activity-heatmap');
        if (!container || typeof Plotly === 'undefined' || heatmapData.length === 0) return;

        // 建立 24x4 的矩陣（24 小時，每小時 4 個 15 分鐘區塊）
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const minuteBlocks = [0, 15, 30, 45];
        const matrix: number[][] = hours.map(() => [0, 0, 0, 0]);

        heatmapData.forEach(item => {
            const hourIndex = item.hour;
            const blockIndex = item.minute_block / 15;
            if (matrix[hourIndex] && blockIndex >= 0 && blockIndex < 4) {
                matrix[hourIndex][blockIndex] = item.count;
            }
        });

        const data = [{
            z: matrix,
            x: minuteBlocks.map(m => `:${m.toString().padStart(2, '0')}`),
            y: hours.map(h => `${h}:00`),
            type: 'heatmap',
            colorscale: 'YlOrRd',
        }];

        const layout = {
            title: '活動時間熱力圖',
            height: 400,
            margin: { t: 40, b: 60, l: 60, r: 20 },
            xaxis: { title: '分鐘' },
            yaxis: { title: '小時' },
        };

        Plotly.newPlot(container, data, layout, { responsive: true });
    }

    /**
     * 顯示訊息
     */
    private showMessage(message: string): void {
        this.loadingElement.style.display = 'none';
        this.chartContainer.style.display = 'none';
        this.summaryContainer.innerHTML = `
      <div class="jp-edu-report-message">
        <p>${message}</p>
      </div>
    `;
    }
}
