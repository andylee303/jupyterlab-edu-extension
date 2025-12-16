"""
Supabase 客戶端封裝

提供與 Supabase 資料庫互動的統一介面。
"""

from supabase import AsyncClient, create_async_client

from ..config import get_settings


class SupabaseClient:
    """Supabase 非同步客戶端封裝"""

    _client: AsyncClient | None = None
    _current_url: str | None = None  # 追蹤當前使用的 URL

    @classmethod
    async def get_client(cls) -> AsyncClient:
        """取得 Supabase 客戶端實例

        使用 Service Role Key 進行後端操作，繞過 RLS。
        如果設定有變更，會重新建立客戶端。

        Returns:
            AsyncClient: Supabase 非同步客戶端

        Raises:
            ValueError: 如果 Supabase 未設定
        """
        settings = get_settings()
        
        # 檢查是否已配置
        if not settings.is_supabase_configured:
            raise ValueError("Supabase 未設定，請先在設定中填入 Supabase URL 和 Key")
        
        # 如果 URL 變更，重新建立客戶端
        if cls._client is None or cls._current_url != settings.supabase_url:
            if cls._client is not None:
                try:
                    await cls._client.aclose()
                except Exception:
                    pass
            
            cls._client = await create_async_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
            cls._current_url = settings.supabase_url
            
        return cls._client

    @classmethod
    async def close(cls):
        """關閉客戶端連線"""
        if cls._client is not None:
            try:
                await cls._client.aclose()
            except Exception:
                pass
            cls._client = None
            cls._current_url = None


async def get_supabase() -> AsyncClient:
    """取得 Supabase 客戶端的便捷函數

    Returns:
        AsyncClient: Supabase 非同步客戶端
        
    Raises:
        ValueError: 如果 Supabase 未設定
    """
    return await SupabaseClient.get_client()
