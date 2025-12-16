"""
配置管理模組

使用 python-dotenv 載入環境變數，提供類型安全的配置存取。
支援多個 .env 文件位置，包括用戶目錄。
"""

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """應用程式配置設定"""

    # Supabase 配置
    supabase_url: str = Field(default="", description="Supabase 專案 URL")
    supabase_anon_key: str = Field(default="", description="Supabase Anonymous Key")
    supabase_service_role_key: str = Field(default="", description="Supabase Service Role Key")

    # OpenAI 配置
    openai_api_key: str = Field(default="", description="OpenAI API Key")
    openai_model: str = Field(default="gpt-5-mini", description="OpenAI 模型名稱")

    # 應用程式配置
    app_debug: bool = Field(default=False, description="除錯模式")
    app_log_level: str = Field(default="INFO", description="日誌等級")

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }

    @property
    def is_supabase_configured(self) -> bool:
        """檢查 Supabase 是否已配置"""
        return bool(self.supabase_url and self.supabase_anon_key)

    @property
    def is_openai_configured(self) -> bool:
        """檢查 OpenAI 是否已配置"""
        return bool(self.openai_api_key)


def find_env_file() -> Path | None:
    """尋找 .env 文件
    
    按優先順序搜尋：
    1. 當前工作目錄
    2. 用戶配置目錄 (~/.jupyterlab-edu-extension/)
    3. 擴展安裝目錄
    """
    possible_paths = [
        Path.cwd() / ".env",
        Path.home() / ".jupyterlab-edu-extension" / ".env",
        Path(__file__).parent.parent / ".env",
    ]

    for env_path in possible_paths:
        if env_path.exists():
            return env_path

    return None


@lru_cache
def get_settings() -> Settings:
    """取得應用程式設定（使用快取）

    Returns:
        Settings: 配置設定實例
    """
    env_path = find_env_file()
    
    if env_path:
        return Settings(_env_file=str(env_path))

    return Settings()
