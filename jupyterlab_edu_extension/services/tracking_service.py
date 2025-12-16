"""
操作追蹤服務

記錄學生的程式執行歷程與 ChatGPT 對話。
"""

from typing import Any

from .supabase_client import get_supabase


class TrackingService:
    """操作追蹤服務類別"""

    async def log_execution(
        self,
        session_id: str,
        cell_id: str | None,
        cell_content: str,
        execution_count: int | None,
        output: str,
        error_output: str | None,
        chatgpt_analysis: str | None,
        execution_time_ms: int,
    ) -> str | None:
        """記錄程式執行

        Args:
            session_id: 會話 ID
            cell_id: Cell ID
            cell_content: 程式碼內容
            execution_count: 執行計數
            output: 執行結果
            error_output: 錯誤訊息
            chatgpt_analysis: ChatGPT 分析結果
            execution_time_ms: 執行時間（毫秒）

        Returns:
            記錄 ID，或 None 如果失敗
        """
        supabase = await get_supabase()

        try:
            result = await supabase.table("execution_logs").insert({
                "session_id": session_id,
                "cell_id": cell_id,
                "cell_content": cell_content,
                "execution_count": execution_count,
                "output": output[:10000] if output else "",  # 限制輸出長度
                "error_output": error_output[:5000] if error_output else None,
                "chatgpt_analysis": chatgpt_analysis,
                "execution_time_ms": execution_time_ms,
            }).execute()

            return result.data[0]["id"] if result.data else None

        except Exception as e:
            print(f"[TrackingService] 記錄執行失敗: {e}")
            return None

    async def log_chat(
        self,
        session_id: str,
        role: str,
        content: str,
        context: dict[str, Any] | None,
    ) -> str | None:
        """記錄 ChatGPT 對話

        Args:
            session_id: 會話 ID
            role: 角色（'user' 或 'assistant'）
            content: 訊息內容
            context: Notebook 上下文（可選）

        Returns:
            記錄 ID，或 None 如果失敗
        """
        supabase = await get_supabase()

        try:
            result = await supabase.table("chat_logs").insert({
                "session_id": session_id,
                "role": role,
                "content": content[:20000] if content else "",  # 限制內容長度
                "context": context,
            }).execute()

            return result.data[0]["id"] if result.data else None

        except Exception as e:
            print(f"[TrackingService] 記錄對話失敗: {e}")
            return None

    async def get_execution_logs(
        self,
        session_id: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """取得執行記錄

        Args:
            session_id: 會話 ID
            limit: 最大筆數

        Returns:
            執行記錄列表
        """
        supabase = await get_supabase()

        try:
            result = await supabase.table("execution_logs").select("*").eq(
                "session_id", session_id
            ).order("executed_at", desc=False).limit(limit).execute()

            return result.data or []

        except Exception:
            return []

    async def get_chat_logs(
        self,
        session_id: str,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """取得對話記錄

        Args:
            session_id: 會話 ID
            limit: 最大筆數

        Returns:
            對話記錄列表
        """
        supabase = await get_supabase()

        try:
            result = await supabase.table("chat_logs").select("*").eq(
                "session_id", session_id
            ).order("created_at", desc=False).limit(limit).execute()

            return result.data or []

        except Exception:
            return []
