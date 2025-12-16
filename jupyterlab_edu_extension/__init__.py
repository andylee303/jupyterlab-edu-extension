"""
JupyterLab 教學擴展 - 學生追蹤、ChatGPT 整合與學習分析

此套件提供 JupyterLab Server Extension，處理：
- 學生身份驗證
- 操作歷程追蹤
- ChatGPT API 代理
- 學習分析報告
"""

from .handlers import setup_handlers


def _jupyter_labextension_paths():
    """定義前端擴展路徑"""
    return [{"src": "labextension", "dest": "jupyterlab-edu-extension"}]


def _jupyter_server_extension_points():
    """定義 Server Extension 入口點"""
    return [{"module": "jupyterlab_edu_extension"}]


def _load_jupyter_server_extension(server_app):
    """載入 Server Extension

    Args:
        server_app: JupyterLab Server Application 實例
    """
    setup_handlers(server_app.web_app)
    name = "jupyterlab_edu_extension"
    server_app.log.info(f"[{name}] 教學擴展已載入")


# 向後兼容 Jupyter Server 1.x
load_jupyter_server_extension = _load_jupyter_server_extension
