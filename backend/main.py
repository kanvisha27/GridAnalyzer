"""Grid Analyzer API. Run from the backend folder:  uvicorn main:app --reload"""

import os

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from algorithms.dcflow import GridError
from routes import analysis, health

app = FastAPI(
    title="Grid Analyzer API",
    description="Educational DC power-flow and contingency analysis. Not for real grid operation.",
    version="1.0.0",
)

origins = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


def _error(status: int, code: str, message: str, details=None) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message, "details": details or {}}})


@app.exception_handler(GridError)
async def grid_error_handler(_request: Request, exc: GridError):
    return _error(422, exc.code, exc.message, exc.details)


@app.exception_handler(RequestValidationError)
async def validation_handler(_request: Request, exc: RequestValidationError):
    parts = []
    for err in exc.errors():
        where = ".".join(str(p) for p in err["loc"] if p != "body")
        parts.append(f"{where}: {err['msg']}")
    return _error(422, "validation_error", "Invalid request data - " + "; ".join(parts[:5]))


app.include_router(health.router, prefix="/api")
app.include_router(analysis.router, prefix="/api")
