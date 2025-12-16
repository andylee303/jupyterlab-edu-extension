"""
身份驗證服務

處理學生登入/登出與會話管理。
"""

from datetime import datetime
from typing import Any

from .supabase_client import get_supabase


class AuthService:
    """身份驗證服務類別"""

    async def login(
        self,
        student_id: str,
        name: str,
        notebook_name: str,
        device_info: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """處理學生登入

        Args:
            student_id: 學號
            name: 姓名
            notebook_name: Notebook 檔案名稱
            device_info: 裝置資訊（可選）

        Returns:
            包含 session_id 的登入結果
        """
        supabase = await get_supabase()

        try:
            # 檢查學生是否存在，不存在則建立
            student_result = await supabase.table("students").select("*").eq(
                "student_id", student_id
            ).execute()

            if not student_result.data:
                # 建立新學生記錄
                await supabase.table("students").insert({
                    "student_id": student_id,
                    "name": name,
                }).execute()
            else:
                # 更新最後活動時間
                await supabase.table("students").update({
                    "last_active_at": datetime.now().isoformat(),
                }).eq("student_id", student_id).execute()

            # 建立新的學習會話
            session_result = await supabase.table("sessions").insert({
                "student_id": student_id,
                "notebook_name": notebook_name,
                "device_info": device_info or {},
            }).execute()

            session_id = session_result.data[0]["id"]

            return {
                "success": True,
                "session_id": session_id,
                "message": "登入成功",
                "student": {
                    "student_id": student_id,
                    "name": name,
                },
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"登入失敗：{e!s}",
            }

    async def logout(self, session_id: str) -> dict[str, Any]:
        """處理學生登出

        Args:
            session_id: 會話 ID

        Returns:
            登出結果
        """
        supabase = await get_supabase()

        try:
            # 更新會話結束時間
            await supabase.table("sessions").update({
                "ended_at": datetime.now().isoformat(),
            }).eq("id", session_id).execute()

            return {
                "success": True,
                "message": "登出成功",
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"登出失敗：{e!s}",
            }

    async def get_student(self, student_id: str) -> dict[str, Any] | None:
        """取得學生資料

        Args:
            student_id: 學號

        Returns:
            學生資料，或 None 如果不存在
        """
        supabase = await get_supabase()

        try:
            result = await supabase.table("students").select("*").eq(
                "student_id", student_id
            ).execute()

            if result.data:
                return result.data[0]
            return None

        except Exception:
            return None

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        """取得會話資料

        Args:
            session_id: 會話 ID

        Returns:
            會話資料，或 None 如果不存在
        """
        supabase = await get_supabase()

        try:
            result = await supabase.table("sessions").select("*").eq(
                "id", session_id
            ).execute()

            if result.data:
                return result.data[0]
            return None

        except Exception:
            return None
