from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routes.chat import router as chat_router
from app.routes.voice import router as voice_router

settings = get_settings()

app = FastAPI(
    title="Love Your Boyfriend API",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(chat_router)
app.include_router(voice_router)


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "loveyourboyfriend-api",
        "revision": settings.render_git_commit[:7],
        "chat_provider": urlparse(settings.openai_base_url).hostname or "unknown",
        "chat_model": settings.chat_model,
    }
