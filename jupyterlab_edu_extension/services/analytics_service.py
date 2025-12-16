"""
學習分析服務

從執行記錄中產生學習分析報告。
"""

from collections import Counter
from datetime import datetime
from typing import Any

from .supabase_client import get_supabase


class AnalyticsService:
    """學習分析服務類別"""

    async def generate_report(self, session_id: str) -> dict[str, Any]:
        """產生學習分析報告

        Args:
            session_id: 會話 ID

        Returns:
            包含多個分析維度的報告
        """
        supabase = await get_supabase()

        try:
            # 取得執行記錄
            exec_result = await supabase.table("execution_logs").select("*").eq(
                "session_id", session_id
            ).order("executed_at", desc=False).execute()

            logs = exec_result.data or []

            if not logs:
                return self._empty_report()

            return {
                "execution_summary": self._calculate_execution_summary(logs),
                "error_distribution": self._calculate_error_distribution(logs),
                "time_analysis": self._calculate_time_analysis(logs),
                "activity_heatmap": self._calculate_activity_heatmap(logs),
                "cell_analysis": self._calculate_cell_analysis(logs),
            }

        except Exception as e:
            print(f"[AnalyticsService] 產生報告失敗: {e}")
            return self._empty_report()

    def _empty_report(self) -> dict[str, Any]:
        """產生空報告"""
        return {
            "execution_summary": {
                "total_executions": 0,
                "successful_executions": 0,
                "failed_executions": 0,
                "success_rate": 0,
            },
            "error_distribution": [],
            "time_analysis": {
                "total_time_ms": 0,
                "avg_time_ms": 0,
                "cell_times": [],
            },
            "activity_heatmap": [],
            "cell_analysis": [],
        }

    def _calculate_execution_summary(self, logs: list[dict]) -> dict[str, Any]:
        """計算執行摘要統計

        Returns:
            {
                "total_executions": 總執行次數,
                "successful_executions": 成功次數,
                "failed_executions": 失敗次數,
                "success_rate": 成功率 (0-100)
            }
        """
        total = len(logs)
        failed = sum(1 for log in logs if log.get("error_output"))
        successful = total - failed

        return {
            "total_executions": total,
            "successful_executions": successful,
            "failed_executions": failed,
            "success_rate": round((successful / total * 100) if total > 0 else 0, 1),
        }

    def _calculate_error_distribution(self, logs: list[dict]) -> list[dict[str, Any]]:
        """計算錯誤類型分佈

        Returns:
            [
                {"error_type": "SyntaxError", "count": 5},
                {"error_type": "NameError", "count": 3},
                ...
            ]
        """
        error_types = []

        for log in logs:
            error_output = log.get("error_output", "")
            if error_output:
                # 嘗試提取錯誤類型
                error_type = self._extract_error_type(error_output)
                error_types.append(error_type)

        counter = Counter(error_types)
        return [
            {"error_type": error_type, "count": count}
            for error_type, count in counter.most_common(10)
        ]

    def _extract_error_type(self, error_output: str) -> str:
        """從錯誤訊息中提取錯誤類型"""
        # 常見 Python 錯誤類型
        error_patterns = [
            "SyntaxError",
            "NameError",
            "TypeError",
            "ValueError",
            "IndexError",
            "KeyError",
            "AttributeError",
            "ImportError",
            "ModuleNotFoundError",
            "ZeroDivisionError",
            "FileNotFoundError",
            "IndentationError",
            "RuntimeError",
            "MemoryError",
            "RecursionError",
        ]

        for pattern in error_patterns:
            if pattern in error_output:
                return pattern

        return "其他錯誤"

    def _calculate_time_analysis(self, logs: list[dict]) -> dict[str, Any]:
        """計算執行時間分析

        Returns:
            {
                "total_time_ms": 總執行時間,
                "avg_time_ms": 平均執行時間,
                "max_time_ms": 最長執行時間,
                "cell_times": [
                    {"cell_id": "xxx", "avg_time_ms": 123, "execution_count": 5}
                ]
            }
        """
        times = [log.get("execution_time_ms", 0) for log in logs]
        total_time = sum(times)
        avg_time = total_time / len(times) if times else 0

        # 按 Cell 分組計算
        cell_times = {}
        for log in logs:
            cell_id = log.get("cell_id", "unknown")
            time_ms = log.get("execution_time_ms", 0)

            if cell_id not in cell_times:
                cell_times[cell_id] = {"times": [], "count": 0}

            cell_times[cell_id]["times"].append(time_ms)
            cell_times[cell_id]["count"] += 1

        cell_time_list = [
            {
                "cell_id": cell_id,
                "avg_time_ms": round(sum(data["times"]) / len(data["times"]), 1),
                "execution_count": data["count"],
            }
            for cell_id, data in cell_times.items()
        ]

        return {
            "total_time_ms": total_time,
            "avg_time_ms": round(avg_time, 1),
            "max_time_ms": max(times) if times else 0,
            "cell_times": cell_time_list,
        }

    def _calculate_activity_heatmap(self, logs: list[dict]) -> list[dict[str, Any]]:
        """計算活動熱力圖資料

        Returns:
            [
                {"hour": 14, "minute_block": 0, "count": 5},
                {"hour": 14, "minute_block": 15, "count": 3},
                ...
            ]
        """
        activity_blocks = Counter()

        for log in logs:
            executed_at = log.get("executed_at")
            if executed_at:
                try:
                    if isinstance(executed_at, str):
                        dt = datetime.fromisoformat(executed_at.replace("Z", "+00:00"))
                    else:
                        dt = executed_at

                    hour = dt.hour
                    minute_block = (dt.minute // 15) * 15  # 15 分鐘區塊
                    activity_blocks[(hour, minute_block)] += 1
                except (ValueError, AttributeError):
                    continue

        return [
            {"hour": hour, "minute_block": minute_block, "count": count}
            for (hour, minute_block), count in sorted(activity_blocks.items())
        ]

    def _calculate_cell_analysis(self, logs: list[dict]) -> list[dict[str, Any]]:
        """計算每個 Cell 的分析

        Returns:
            [
                {
                    "cell_id": "xxx",
                    "execution_count": 10,
                    "error_count": 2,
                    "first_execution": "2024-01-01T12:00:00",
                    "last_execution": "2024-01-01T12:30:00"
                }
            ]
        """
        cell_data = {}

        for log in logs:
            cell_id = log.get("cell_id", "unknown")

            if cell_id not in cell_data:
                cell_data[cell_id] = {
                    "execution_count": 0,
                    "error_count": 0,
                    "first_execution": log.get("executed_at"),
                    "last_execution": log.get("executed_at"),
                }

            cell_data[cell_id]["execution_count"] += 1
            if log.get("error_output"):
                cell_data[cell_id]["error_count"] += 1
            cell_data[cell_id]["last_execution"] = log.get("executed_at")

        return [
            {"cell_id": cell_id, **data}
            for cell_id, data in cell_data.items()
        ]
