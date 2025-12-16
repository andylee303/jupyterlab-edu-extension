"""
ChatGPT 整合服務（優化版）

提供程式碼分析與對話功能，使用 OpenAI API。
支援串流回應、快取機制。
"""

import asyncio
import hashlib
import json
from collections import OrderedDict
from typing import Any, AsyncIterator

from openai import AsyncOpenAI

from ..config import get_settings


class LRUCache:
    """簡易 LRU 快取"""
    
    def __init__(self, max_size: int = 100):
        self.cache: OrderedDict[str, str] = OrderedDict()
        self.max_size = max_size
    
    def get(self, key: str) -> str | None:
        if key in self.cache:
            # 移到最後（最近使用）
            self.cache.move_to_end(key)
            return self.cache[key]
        return None
    
    def set(self, key: str, value: str) -> None:
        if key in self.cache:
            self.cache.move_to_end(key)
        else:
            if len(self.cache) >= self.max_size:
                # 移除最舊的項目
                self.cache.popitem(last=False)
        self.cache[key] = value
    
    @staticmethod
    def make_key(*args: Any) -> str:
        """從參數建立快取鍵"""
        content = json.dumps(args, sort_keys=True, ensure_ascii=False)
        return hashlib.md5(content.encode()).hexdigest()


class ChatGPTService:
    """ChatGPT 服務類別（優化版）"""
    
    # 類別級別的快取（所有實例共享）
    _error_cache = LRUCache(max_size=200)
    _code_cache = LRUCache(max_size=100)

    def __init__(self):
        """初始化 ChatGPT 服務"""
        settings = get_settings()
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.model = settings.openai_model

    async def analyze_error(self, code: str, error: str, use_cache: bool = True) -> str:
        """分析程式錯誤（支援快取）

        Args:
            code: 程式碼內容
            error: 錯誤訊息
            use_cache: 是否使用快取

        Returns:
            繁體中文的錯誤分析與建議
        """
        # 檢查快取
        if use_cache:
            cache_key = self._error_cache.make_key(code.strip(), error.strip())
            cached = self._error_cache.get(cache_key)
            if cached:
                return cached

        system_prompt = """你是一位親切的程式教學助教，專門幫助初學者理解程式錯誤。

你的任務是：
1. 用繁體中文解釋錯誤訊息的含義
2. 指出程式碼中導致錯誤的具體位置
3. 提供修正建議
4. 如果適合，給予學習相關概念的提示

請使用簡潔、易懂的語言，避免過於專業的術語。
回應格式：
## 🔍 錯誤說明
（錯誤類型與原因說明）

## 📍 問題位置
（指出程式碼中的問題）

## ✅ 修正建議
（具體的修正方式）

## 💡 學習提示
（相關概念或常見陷阱）
"""

        user_message = f"""請分析以下程式碼的錯誤：

**程式碼：**
```python
{code}
```

**錯誤訊息：**
```
{error}
```
"""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )

            result = response.choices[0].message.content or "無法分析此錯誤"
            
            # 儲存到快取
            if use_cache:
                self._error_cache.set(cache_key, result)
            
            return result

        except Exception as e:
            return f"分析錯誤時發生問題：{e!s}"

    async def analyze_code(self, code: str, context: str | None = None) -> str:
        """分析程式碼

        Args:
            code: 程式碼內容
            context: 額外上下文（可選）

        Returns:
            繁體中文的程式碼分析
        """
        system_prompt = """你是一位程式教學助教，幫助學生理解程式碼的運作方式。

請用繁體中文：
1. 逐步解釋程式碼的功能
2. 說明關鍵語法與概念
3. 如果有改進空間，提供建議

使用簡潔、易懂的語言。"""

        user_message = f"請解釋這段程式碼：\n\n```python\n{code}\n```"
        if context:
            user_message += f"\n\n額外背景資訊：{context}"

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
            )

            return response.choices[0].message.content or "無法分析此程式碼"

        except Exception as e:
            return f"分析程式碼時發生問題：{e!s}"

    async def chat(
        self,
        message: str,
        notebook_context: dict[str, Any] | None = None,
    ) -> str:
        """與 ChatGPT 進行對話（非串流）

        Args:
            message: 用戶訊息
            notebook_context: Notebook 上下文

        Returns:
            ChatGPT 回應
        """
        messages = self._build_chat_messages(message, notebook_context)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
            )

            return response.choices[0].message.content or "抱歉，我無法回應這個問題。"

        except Exception as e:
            return f"發生錯誤：{e!s}"

    async def chat_stream(
        self,
        message: str,
        notebook_context: dict[str, Any] | None = None,
    ) -> AsyncIterator[str]:
        """與 ChatGPT 進行串流對話

        Args:
            message: 用戶訊息
            notebook_context: Notebook 上下文

        Yields:
            串流的文字片段
        """
        messages = self._build_chat_messages(message, notebook_context)

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        except Exception as e:
            yield f"發生錯誤：{e!s}"

    def _build_chat_messages(
        self,
        message: str,
        notebook_context: dict[str, Any] | None = None,
    ) -> list[dict[str, str]]:
        """建構聊天訊息列表"""
        system_prompt = """你是一位友善的程式教學助教，正在協助學生學習 Python 程式設計。

你可以存取學生目前正在編輯的 Jupyter Notebook 內容。請根據這些上下文來回答問題。

回應規則：
1. 使用繁體中文回答
2. 說明要清楚、易懂
3. 適時提供程式碼範例
4. 鼓勵學生思考，而不是直接給答案
5. 如果學生問的問題與 Notebook 內容無關，也可以正常回答
"""

        # 建構上下文訊息
        context_message = ""
        if notebook_context and notebook_context.get("cells"):
            cells = notebook_context["cells"]
            current_index = notebook_context.get("current_cell_index", 0)

            context_parts = ["目前 Notebook 的內容：\n"]
            for i, cell in enumerate(cells[:20]):  # 限制最多 20 個 cells
                cell_type = cell.get("type", "code")
                content = cell.get("content", "")[:500]  # 限制每個 cell 內容長度

                marker = "👉 " if i == current_index else ""
                context_parts.append(f"{marker}[{cell_type.upper()} Cell {i + 1}]\n{content}\n")

            context_message = "\n".join(context_parts)

        messages = [{"role": "system", "content": system_prompt}]

        if context_message:
            messages.append({
                "role": "system",
                "content": f"以下是學生目前的 Notebook 內容供你參考：\n\n{context_message}",
            })

        messages.append({"role": "user", "content": message})
        return messages
