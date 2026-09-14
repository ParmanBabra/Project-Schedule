"""FastAPI application entry point.

Feature routers are registered here. Each feature lives in `app/features/<name>/`
with its own `router.py`, `schemas.py`, `service.py` and (when it owns data)
`repository.py`. Business logic never imports FastAPI.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_TITLE, APP_VERSION, data_dir


def create_app() -> FastAPI:
    app = FastAPI(title=APP_TITLE, version=APP_VERSION)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": APP_VERSION, "dataDir": str(data_dir())}

    # Feature routers are added phase by phase (see docs/plan.md):
    # from app.features.projects.router import router as projects_router
    # app.include_router(projects_router, prefix="/api")

    return app


app = create_app()
