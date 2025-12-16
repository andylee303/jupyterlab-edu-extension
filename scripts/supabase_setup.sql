-- =============================================================================
-- JupyterLab 教學擴展 - Supabase 資料庫設置腳本
-- =============================================================================
-- 請在 Supabase Dashboard 的 SQL Editor 中執行此腳本
-- =============================================================================

-- 1. 建立 students 資料表（學生資料）
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(20) UNIQUE NOT NULL,  -- 學號（唯一識別）
    name VARCHAR(100) NOT NULL,               -- 姓名
    created_at TIMESTAMPTZ DEFAULT NOW(),     -- 建立時間
    last_active_at TIMESTAMPTZ DEFAULT NOW()  -- 最後活動時間
);

-- 建立學號索引
CREATE INDEX IF NOT EXISTS idx_students_student_id ON students(student_id);

COMMENT ON TABLE students IS '學生資料表';
COMMENT ON COLUMN students.student_id IS '學號，作為唯一識別';
COMMENT ON COLUMN students.name IS '學生姓名';

-- =============================================================================

-- 2. 建立 sessions 資料表（學習會話）
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id),
    notebook_name VARCHAR(255) NOT NULL,      -- ipynb 檔案名稱
    started_at TIMESTAMPTZ DEFAULT NOW(),     -- 會話開始時間
    ended_at TIMESTAMPTZ,                     -- 會話結束時間
    device_info JSONB DEFAULT '{}'::jsonb     -- 裝置資訊（如樹莓派型號）
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_sessions_student_id ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);

COMMENT ON TABLE sessions IS '學習會話表，記錄每次開啟 Notebook 的會話';
COMMENT ON COLUMN sessions.notebook_name IS 'Notebook 檔案名稱';
COMMENT ON COLUMN sessions.device_info IS '裝置資訊 JSON，可記錄樹莓派等 IoT 裝置資訊';

-- =============================================================================

-- 3. 建立 execution_logs 資料表（程式執行記錄）
CREATE TABLE IF NOT EXISTS execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    cell_id VARCHAR(100),                     -- Cell ID
    cell_content TEXT,                        -- 程式碼內容
    execution_count INTEGER,                  -- 執行計數
    output TEXT,                              -- 執行結果
    error_output TEXT,                        -- 錯誤訊息
    chatgpt_analysis TEXT,                    -- ChatGPT 分析結果
    executed_at TIMESTAMPTZ DEFAULT NOW(),    -- 執行時間
    execution_time_ms INTEGER DEFAULT 0       -- 執行耗時（毫秒）
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_execution_logs_session_id ON execution_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_executed_at ON execution_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_execution_logs_cell_id ON execution_logs(cell_id);

COMMENT ON TABLE execution_logs IS '程式執行記錄表';
COMMENT ON COLUMN execution_logs.chatgpt_analysis IS 'ChatGPT 針對錯誤的分析結果（繁體中文）';

-- =============================================================================

-- 4. 建立 chat_logs 資料表（ChatGPT 對話記錄）
CREATE TABLE IF NOT EXISTS chat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,                    -- 訊息內容
    context JSONB,                            -- 當時的 Notebook 上下文
    created_at TIMESTAMPTZ DEFAULT NOW()      -- 建立時間
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_chat_logs_session_id ON chat_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created_at ON chat_logs(created_at);

COMMENT ON TABLE chat_logs IS 'ChatGPT 對話記錄表';
COMMENT ON COLUMN chat_logs.role IS '訊息角色：user（學生）、assistant（AI）、system（系統）';
COMMENT ON COLUMN chat_logs.context IS 'Notebook 上下文 JSON，用於分析學生提問時的情境';

-- =============================================================================

-- 5. 建立有用的 View（視圖）

-- 學生學習摘要視圖
CREATE OR REPLACE VIEW student_learning_summary AS
SELECT 
    s.student_id,
    s.name,
    COUNT(DISTINCT ses.id) AS total_sessions,
    COUNT(el.id) AS total_executions,
    COUNT(CASE WHEN el.error_output IS NOT NULL THEN 1 END) AS total_errors,
    ROUND(
        100.0 * COUNT(CASE WHEN el.error_output IS NULL THEN 1 END) / NULLIF(COUNT(el.id), 0),
        1
    ) AS success_rate,
    MAX(ses.started_at) AS last_session_at
FROM students s
LEFT JOIN sessions ses ON s.student_id = ses.student_id
LEFT JOIN execution_logs el ON ses.id = el.session_id
GROUP BY s.student_id, s.name;

COMMENT ON VIEW student_learning_summary IS '學生學習摘要視圖';

-- =============================================================================

-- 6. 啟用 Realtime（即時更新）
-- 注意：需要在 Supabase Dashboard 的 Table Editor 中手動啟用 Realtime

ALTER PUBLICATION supabase_realtime ADD TABLE execution_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_logs;

-- =============================================================================

-- 7. Row Level Security (RLS) 設定
-- 注意：由於使用 Service Role Key，RLS 會被繞過
-- 如果需要更細緻的權限控制，可以啟用以下設定

-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE execution_logs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 設置完成！
-- =============================================================================
