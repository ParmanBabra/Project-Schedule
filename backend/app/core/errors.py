"""Application errors and their HTTP mapping.

Business code raises `AppError` subclasses; the FastAPI handler turns them into
`{"error": {"code", "message", "details"}}` responses. Never raise HTTPException
from services so the scheduling engine and services stay framework-free.
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    status_code = 400
    code = "bad_request"

    def __init__(self, message: str, *, details: Any = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details

    def to_payload(self) -> dict[str, Any]:
        return {"error": {"code": self.code, "message": self.message, "details": self.details}}


class NotFound(AppError):
    status_code = 404
    code = "not_found"


class Conflict(AppError):
    status_code = 409
    code = "conflict"


class ValidationFailed(AppError):
    status_code = 422
    code = "validation_failed"


class CycleDetected(ValidationFailed):
    code = "cycle_detected"

    def __init__(self, path: list[str]) -> None:
        chain = " → ".join(path)
        super().__init__(f"dependency cycle: {chain}", details={"path": path})
        self.path = path


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_payload())
