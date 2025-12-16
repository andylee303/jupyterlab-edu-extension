"""
API 路由處理器（優化版）

定義所有 REST API 端點，處理前端請求。
支援登入驗證、串流回應、背景記錄。
"""

import asyncio
import json
from datetime import datetime
from functools import wraps
from typing import Callable

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
from tornado import web
from tornado.iostream import StreamClosedError

from .config import get_settings
from .services.analytics_service import AnalyticsService
from .services.auth_service import AuthService
from .services.chatgpt_service import ChatGPTService
from .services.tracking_service import TrackingService

# 全域會話儲存（用於驗證）
_active_sessions: dict[str, dict] = {}


def get_session(session_id: str) -> dict | None:
    """取得會話資料"""
    return _active_sessions.get(session_id)


def set_session(session_id: str, data: dict) -> None:
    """設定會話資料"""
    _active_sessions[session_id] = data


def remove_session(session_id: str) -> None:
    """移除會話"""
    _active_sessions.pop(session_id, None)


def require_login(method: Callable) -> Callable:
    """要求登入的裝飾器"""
    @wraps(method)
    async def wrapper(self: "BaseExtensionHandler", *args, **kwargs):
        body = self.get_json_body()
        session_id = body.get("session_id") or self.get_argument("session_id", None)
        
        if not session_id or not get_session(session_id):
            self.write_json({
                "success": False,
                "error": "請先登入",
                "error_code": "NOT_LOGGED_IN",
            }, status=401)
            return
        
        return await method(self, *args, **kwargs)
    return wrapper


class BaseExtensionHandler(APIHandler):
    """基礎 API Handler，提供共用方法"""

    def get_json_body(self) -> dict:
        """解析 JSON 請求內容"""
        try:
            return json.loads(self.request.body.decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return {}

    def write_json(self, data: dict, status: int = 200):
        """回傳 JSON 回應"""
        self.set_status(status)
        self.set_header("Content-Type", "application/json; charset=utf-8")
        self.finish(json.dumps(data, ensure_ascii=False, default=str))


class AuthLoginHandler(BaseExtensionHandler):
    """學生登入 API"""

    @web.authenticated
    async def post(self):
        """處理學生登入"""
        body = self.get_json_body()
        student_id = body.get("student_id", "").strip()
        name = body.get("name", "").strip()
        notebook_name = body.get("notebook_name", "").strip()

        if not student_id or not name:
            self.write_json(
                {"success": False, "error": "學號和姓名為必填欄位"},
                status=400,
            )
            return

        settings = get_settings()
        
        # 建立本地會話 ID
        session_id = f"session-{student_id}-{datetime.now().timestamp()}"
        
        if settings.is_supabase_configured:
            auth_service = AuthService()
            result = await auth_service.login(student_id, name, notebook_name)
            if result.get("success") and result.get("session_id"):
                session_id = result["session_id"]
        
        # 儲存會話
        set_session(session_id, {
            "student_id": student_id,
            "name": name,
            "notebook_name": notebook_name,
            "logged_in_at": datetime.now().isoformat(),
        })
        
        self.write_json({
            "success": True,
            "session_id": session_id,
            "message": "登入成功",
            "mode": "cloud" if settings.is_supabase_configured else "local",
        })


class AuthLogoutHandler(BaseExtensionHandler):
    """學生登出 API"""

    @web.authenticated
    async def post(self):
        """處理學生登出"""
        body = self.get_json_body()
        session_id = body.get("session_id")

        if session_id:
            remove_session(session_id)
            
            settings = get_settings()
            if settings.is_supabase_configured:
                auth_service = AuthService()
                await auth_service.logout(session_id)

        self.write_json({"success": True, "message": "已登出"})


class AuthCheckHandler(BaseExtensionHandler):
    """檢查登入狀態 API"""

    @web.authenticated
    async def get(self):
        """檢查是否已登入"""
        session_id = self.get_argument("session_id", None)
        
        if session_id and get_session(session_id):
            session_data = get_session(session_id)
            self.write_json({
                "logged_in": True,
                "student_id": session_data.get("student_id"),
                "name": session_data.get("name"),
            })
        else:
            self.write_json({"logged_in": False})


class TrackingExecutionHandler(BaseExtensionHandler):
    """程式執行追蹤 API"""

    @web.authenticated
    @require_login
    async def post(self):
        """記錄程式執行（背景非阻塞）"""
        body = self.get_json_body()
        session_id = body.get("session_id")
        cell_id = body.get("cell_id")
        cell_content = body.get("cell_content", "")
        execution_count = body.get("execution_count")
        output = body.get("output", "")
        error_output = body.get("error_output", "")
        execution_time_ms = body.get("execution_time_ms", 0)

        settings = get_settings()
        chatgpt_analysis = None

        # 如果有錯誤且 OpenAI 已配置，進行分析
        if error_output and settings.is_openai_configured:
            chatgpt_service = ChatGPTService()
            chatgpt_analysis = await chatgpt_service.analyze_error(
                code=cell_content,
                error=error_output,
                use_cache=True,  # 使用快取
            )

        # 背景記錄到資料庫（非阻塞）
        if settings.is_supabase_configured and session_id:
            asyncio.create_task(self._log_execution_background(
                session_id=session_id,
                cell_id=cell_id,
                cell_content=cell_content,
                execution_count=execution_count,
                output=output,
                error_output=error_output,
                chatgpt_analysis=chatgpt_analysis,
                execution_time_ms=execution_time_ms,
            ))

        self.write_json({
            "success": True,
            "chatgpt_analysis": chatgpt_analysis,
        })

    async def _log_execution_background(self, **kwargs):
        """背景記錄執行"""
        try:
            tracking_service = TrackingService()
            await tracking_service.log_execution(**kwargs)
        except Exception as e:
            print(f"[TrackingExecutionHandler] 背景記錄失敗: {e}")


class ChatGPTAnalyzeHandler(BaseExtensionHandler):
    """ChatGPT 程式碼分析 API"""

    @web.authenticated
    @require_login
    async def post(self):
        """分析程式碼或錯誤"""
        body = self.get_json_body()
        code = body.get("code", "")
        error = body.get("error")
        context = body.get("context")

        settings = get_settings()
        if not settings.is_openai_configured:
            self.write_json({
                "success": False,
                "error": "OpenAI API 未配置",
            }, status=503)
            return

        chatgpt_service = ChatGPTService()

        if error:
            analysis = await chatgpt_service.analyze_error(code, error, use_cache=True)
        else:
            analysis = await chatgpt_service.analyze_code(code, context)

        self.write_json({
            "success": True,
            "analysis": analysis,
        })


class ChatGPTChatHandler(BaseExtensionHandler):
    """ChatGPT 對話 API（非串流）"""

    @web.authenticated
    @require_login
    async def post(self):
        """與 ChatGPT 進行對話"""
        body = self.get_json_body()
        session_id = body.get("session_id")
        message = body.get("message", "").strip()
        notebook_context = body.get("notebook_context", {})

        if not message:
            self.write_json({
                "success": False,
                "error": "訊息不可為空",
            }, status=400)
            return

        settings = get_settings()
        if not settings.is_openai_configured:
            self.write_json({
                "success": False,
                "error": "OpenAI API 未配置",
            }, status=503)
            return

        chatgpt_service = ChatGPTService()
        response = await chatgpt_service.chat(message, notebook_context)

        # 背景記錄對話
        if settings.is_supabase_configured and session_id:
            asyncio.create_task(self._log_chat_background(
                session_id, message, response, notebook_context
            ))

        self.write_json({
            "success": True,
            "response": response,
        })

    async def _log_chat_background(self, session_id, message, response, context):
        """背景記錄對話"""
        try:
            tracking_service = TrackingService()
            await tracking_service.log_chat(session_id, "user", message, context)
            await tracking_service.log_chat(session_id, "assistant", response, None)
        except Exception as e:
            print(f"[ChatGPTChatHandler] 背景記錄失敗: {e}")


class ChatGPTStreamHandler(BaseExtensionHandler):
    """ChatGPT 串流對話 API (SSE)"""

    @web.authenticated
    async def post(self):
        """與 ChatGPT 進行串流對話"""
        body = self.get_json_body()
        session_id = body.get("session_id")
        message = body.get("message", "").strip()
        notebook_context = body.get("notebook_context", {})

        # 檢查登入
        if not session_id or not get_session(session_id):
            self.write_json({
                "success": False,
                "error": "請先登入",
                "error_code": "NOT_LOGGED_IN",
            }, status=401)
            return

        if not message:
            self.write_json({
                "success": False,
                "error": "訊息不可為空",
            }, status=400)
            return

        settings = get_settings()
        if not settings.is_openai_configured:
            self.write_json({
                "success": False,
                "error": "OpenAI API 未配置",
            }, status=503)
            return

        # 設定 SSE 標頭
        self.set_header("Content-Type", "text/event-stream; charset=utf-8")
        self.set_header("Cache-Control", "no-cache")
        self.set_header("Connection", "keep-alive")
        self.set_header("X-Accel-Buffering", "no")

        chatgpt_service = ChatGPTService()
        full_response = ""

        try:
            async for chunk in chatgpt_service.chat_stream(message, notebook_context):
                full_response += chunk
                # SSE 格式
                data = json.dumps({"chunk": chunk}, ensure_ascii=False)
                self.write(f"data: {data}\n\n")
                await self.flush()

            # 發送完成訊號
            self.write("data: [DONE]\n\n")
            await self.flush()

            # 背景記錄對話
            if settings.is_supabase_configured and session_id:
                asyncio.create_task(self._log_chat_background(
                    session_id, message, full_response, notebook_context
                ))

        except StreamClosedError:
            pass  # 客戶端關閉連線
        except Exception as e:
            error_data = json.dumps({"error": str(e)}, ensure_ascii=False)
            self.write(f"data: {error_data}\n\n")
            await self.flush()

        self.finish()

    async def _log_chat_background(self, session_id, message, response, context):
        """背景記錄對話"""
        try:
            tracking_service = TrackingService()
            await tracking_service.log_chat(session_id, "user", message, context)
            await tracking_service.log_chat(session_id, "assistant", response, None)
        except Exception as e:
            print(f"[ChatGPTStreamHandler] 背景記錄失敗: {e}")


class AnalyticsReportHandler(BaseExtensionHandler):
    """學習分析報告 API"""

    @web.authenticated
    @require_login
    async def get(self):
        """取得學習分析報告"""
        session_id = self.get_argument("session_id", None)

        settings = get_settings()
        if not settings.is_supabase_configured:
            # 返回模擬資料
            self.write_json({
                "success": True,
                "report": {
                    "execution_summary": {
                        "total_executions": 0,
                        "successful_executions": 0,
                        "failed_executions": 0,
                    },
                    "error_distribution": [],
                    "time_analysis": {
                        "total_time_ms": 0,
                        "avg_time_ms": 0,
                        "cell_times": [],
                    },
                    "activity_heatmap": [],
                },
                "mode": "local",
            })
            return

        if not session_id:
            self.write_json({
                "success": False,
                "error": "session_id 為必填參數",
            }, status=400)
            return

        analytics_service = AnalyticsService()
        report = await analytics_service.generate_report(session_id)

        self.write_json({
            "success": True,
            "report": report,
        })


class HealthCheckHandler(BaseExtensionHandler):
    """健康檢查 API"""

    @web.authenticated
    async def get(self):
        """檢查服務狀態"""
        settings = get_settings()
        self.write_json({
            "status": "ok",
            "supabase_configured": settings.is_supabase_configured,
            "openai_configured": settings.is_openai_configured,
        })


class ConfigSaveHandler(BaseExtensionHandler):
    """儲存配置 API"""

    @web.authenticated
    async def post(self):
        """儲存配置到 .env 文件"""
        from pathlib import Path
        
        body = self.get_json_body()
        
        openai_api_key = body.get("openai_api_key", "").strip()
        openai_model = body.get("openai_model", "gpt-5-mini").strip()
        supabase_url = body.get("supabase_url", "").strip()
        supabase_anon_key = body.get("supabase_anon_key", "").strip()
        supabase_service_role_key = body.get("supabase_service_role_key", "").strip()
        
        if not openai_api_key:
            self.write_json(
                {"success": False, "error": "OpenAI API Key 為必填"},
                status=400,
            )
            return
        
        # 尋找或建立 .env 文件
        possible_paths = [
            Path.cwd() / ".env",
            Path.home() / ".jupyterlab-edu-extension" / ".env",
        ]
        
        env_path = None
        for path in possible_paths:
            if path.exists():
                env_path = path
                break
        
        if not env_path:
            # 建立新的 .env 文件在用戶目錄
            env_path = Path.home() / ".jupyterlab-edu-extension" / ".env"
            env_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 讀取現有配置
        existing_config = {}
        if env_path.exists():
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, value = line.split("=", 1)
                        existing_config[key.strip()] = value.strip()
        
        # 更新配置
        existing_config["OPENAI_API_KEY"] = openai_api_key
        existing_config["OPENAI_MODEL"] = openai_model
        if supabase_url:
            existing_config["SUPABASE_URL"] = supabase_url
        if supabase_anon_key:
            existing_config["SUPABASE_ANON_KEY"] = supabase_anon_key
        if supabase_service_role_key:
            existing_config["SUPABASE_SERVICE_ROLE_KEY"] = supabase_service_role_key
        
        # 寫入配置
        with open(env_path, "w", encoding="utf-8") as f:
            f.write("# JupyterLab 教學擴展配置\n")
            f.write("# 此文件由擴展自動生成\n\n")
            for key, value in existing_config.items():
                f.write(f"{key}={value}\n")
        
        # 清除配置快取，讓新設定生效
        from .config import get_settings
        get_settings.cache_clear()
        
        self.write_json({
            "success": True,
            "message": "設定已儲存",
            "env_path": str(env_path),
        })


def setup_handlers(web_app):
    """設置 API 路由"""
    host_pattern = ".*$"
    base_url = web_app.settings.get("base_url", "/")

    handlers = [
        # 健康檢查
        (url_path_join(base_url, "edu-extension", "api", "health"), HealthCheckHandler),
        # 身份驗證
        (url_path_join(base_url, "edu-extension", "api", "auth", "login"), AuthLoginHandler),
        (url_path_join(base_url, "edu-extension", "api", "auth", "logout"), AuthLogoutHandler),
        (url_path_join(base_url, "edu-extension", "api", "auth", "check"), AuthCheckHandler),
        # 操作追蹤
        (
            url_path_join(base_url, "edu-extension", "api", "tracking", "execution"),
            TrackingExecutionHandler,
        ),
        # ChatGPT
        (
            url_path_join(base_url, "edu-extension", "api", "chatgpt", "analyze"),
            ChatGPTAnalyzeHandler,
        ),
        (url_path_join(base_url, "edu-extension", "api", "chatgpt", "chat"), ChatGPTChatHandler),
        (url_path_join(base_url, "edu-extension", "api", "chatgpt", "stream"), ChatGPTStreamHandler),
        # 學習分析
        (
            url_path_join(base_url, "edu-extension", "api", "analytics", "report"),
            AnalyticsReportHandler,
        ),
        # 配置管理
        (
            url_path_join(base_url, "edu-extension", "api", "config", "save"),
            ConfigSaveHandler,
        ),
    ]

    web_app.add_handlers(host_pattern, handlers)
