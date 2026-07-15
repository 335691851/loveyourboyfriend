import httpx
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import Runnable
from langchain_openai import ChatOpenAI

from app.ai.prompts import COMPANION_SYSTEM_PROMPT
from app.config import Settings, get_settings


def build_chat_model(
    settings: Settings | None = None,
    *,
    http_async_client: httpx.AsyncClient | None = None,
) -> ChatOpenAI:
    current = settings or get_settings()
    if not current.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required")
    return ChatOpenAI(
        model=current.chat_model,
        api_key=current.openai_api_key,
        base_url=current.openai_base_url,
        extra_body={"enable_thinking": False, "max_tokens": 320},
        streaming=True,
        stream_chunk_timeout=8,
        timeout=20,
        max_retries=0,
        http_async_client=http_async_client,
    )


def build_memory_model(settings: Settings | None = None) -> ChatOpenAI:
    current = settings or get_settings()
    if not current.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required")
    return ChatOpenAI(
        model=current.memory_model,
        api_key=current.openai_api_key,
        base_url=current.openai_base_url,
        extra_body={"enable_thinking": False, "max_tokens": 256},
        timeout=15,
        max_retries=2,
    )


def build_chat_chain(
    model: BaseChatModel | None = None,
    settings: Settings | None = None,
) -> Runnable:
    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                COMPANION_SYSTEM_PROMPT + "\n\n以下是用户已经明确确认的长期记忆：\n{memories}",
            ),
            MessagesPlaceholder("history"),
            ("human", "{user_input}"),
        ]
    )
    return prompt | (model or build_chat_model(settings)) | StrOutputParser()
