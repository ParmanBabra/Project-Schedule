"""FastAPI application entry point.

Feature routers are registered here. Each feature lives in `app/features/<name>/`
with its own `router.py`, `schemas.py`, `service.py` and (when it owns data)
`repository.py`. Business logic never imports FastAPI.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import APP_TITLE, APP_VERSION, data_dir
from app.core.errors import install_error_handlers
from app.features.dependencies.router import router as dependencies_router
from app.features.projects.router import router as projects_router
from app.features.scheduling.router import router as scheduling_router
from app.features.settings.router import router as settings_router
from app.features.tasks.router import router as tasks_router


def create_app() -> FastAPI:
    app = FastAPI(title=APP_TITLE, version=APP_VERSION)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    install_error_handlers(app)

    @app.get("/api/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": APP_VERSION, "dataDir": str(data_dir())}

    for r in (
        projects_router,
        tasks_router,
        dependencies_router,
        scheduling_router,
        settings_router,
    ):
        app.include_router(r, prefix="/api")

    return app


app = create_app()
