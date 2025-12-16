"""
Supabase 客戶端封裝

提供與 Supabase 資料庫互動的統一介面。
"""

from functools import lru_cache

from supabase import AsyncClient, create_async_client

from ..config import get_settings


class SupabaseClient:
    """Supabase 非同步客戶端封裝"""

    _client: AsyncClient | None = None

    @classmethod
    async def get_client(cls) -> AsyncClient:
        """取得 Supabase 客戶端實例

        使用 Service Role Key 進行後端操作，繞過 RLS。

        Returns:
            AsyncClient: Supabase 非同步客戶端
        """
        if cls._client is None:
            settings = get_settings()
            cls._client = await create_async_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )
        return cls._client

    @classmethod
    async def close(cls):
        """關閉客戶端連線"""
        if cls._client is not None:
            await cls._client.aclose()
            cls._client = None


async def get_supabase() -> AsyncClient:
    """取得 Supabase 客戶端的便捷函數

    Returns:
        AsyncClient: Supabase 非同步客戶端
    """
    return await SupabaseClient.get_client()
