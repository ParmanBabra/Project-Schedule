"""FastAPI application entry point.

Feature routers are registered here. Each feature lives in `app/features/<name>/`
with its own `router.py`, `schemas.py`, `service.py` and (when it owns data)
`repository.py`. Business logic never imports FastAPI.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import APP_TITLE, APP_VERSION, settings
from app.core.errors import install_error_handlers
from app.core.web import AuthGateMiddleware, SecurityHeadersMiddleware, mount_spa
from app.features.assignments.router import router as assignments_router
from app.features.auth.router import router as auth_router
from app.features.dependencies.router import router as dependencies_router
from app.features.epics.router import router as epics_router
from app.features.io.router import router as io_router
from app.features.projects.baseline import router as baseline_router
from app.features.projects.router import router as projects_router
from app.features.releases.router import router as releases_router
from app.features.resources.router import router as resources_router
from app.features.scheduling.router import router as scheduling_router
from app.features.settings.router import router as settings_router
from app.features.tasks.router import router as tasks_router


def create_app() -> FastAPI:
    cfg = settings()
    app = FastAPI(title=APP_TITLE, version=APP_VERSION, docs_url=None, redoc_url=None)

    origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
    if cfg.public_origin:
        origins.append(cfg.public_origin)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(GZipMiddleware, minimum_size=1000)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(AuthGateMiddleware)
    install_error_handlers(app)

    @app.get("/api/health", tags=["system"])
    def health() -> dict[str, str]:
        return {"status": "ok", "version": APP_VERSION}

    for r in (
        auth_router,
        io_router,  # first: /projects/import must not be captured by /{project_id}
        projects_router,
        baseline_router,
        tasks_router,
        epics_router,
        releases_router,
        dependencies_router,
        scheduling_router,
        settings_router,
        resources_router,
        assignments_router,
    ):
        app.include_router(r, prefix="/api")

    if cfg.static_dir is not None:  # production: one process serves API + built frontend
        mount_spa(app, cfg.static_dir)

    return app


app = create_app()
