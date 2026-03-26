"""
HireOn FastAPI application entry point.
Registers all routers, middleware, static files, and startup events.
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.schemas.response import APIResponse
from app.config import settings
from app.database import engine, Base
from app.websocket.manager import ws_manager
from app.middleware.audit import AuditMiddleware
from app.middleware.tenant import TenantMiddleware
import app.models  # noqa: F401 — register all models with Base
from app.routers import (
    auth, organizations, users, jobs, candidates,
    resumes, ai, applications, pipeline,
    interviews, scorecards, offers,
    analytics, notifications, talent_pool, portal, admin, calendar, invitations,
    activities, reports
)
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    logger.info(f"🚀 HireOn API starting in {settings.app_env} mode")

    # Create all DB tables if they don't exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables ensured.")
    except Exception as e:
        logger.warning(f"Skipped table creation (likely concurrent creation by another worker): {e}")

    # Ensure upload directories exist
    Path(settings.upload_dir).mkdir(exist_ok=True)
    for sub in ["resumes", "jds", "offers", "avatars"]:
        Path(settings.upload_dir, sub).mkdir(exist_ok=True)
        
    # Start Redis Pub/Sub listener for WebSockets
    redis_listener_task = asyncio.create_task(ws_manager.listen_to_redis())
    logger.info("Redis WS listener task created.")

    yield
    
    # Clean up
    redis_listener_task.cancel()
    try:
        await redis_listener_task
    except asyncio.CancelledError:
        logger.info("Redis WS listener task cancelled.")
    
    logger.info("HireOn API shutting down")


app = FastAPI(
    title="HireOn API",
    description="AI-powered recruitment automation platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return APIResponse.error(message=str(exc.detail), status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    logger.error(f"422 Validation error on {request.method} {request.url}: {errors}")
    return APIResponse.error(message="There was an issue with the submitted data.", status_code=422, details={"errors": errors})

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return APIResponse.error(message="An unexpected system error occurred. Please try again later.", status_code=500, details={"error": str(exc)})

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://gethireon.netlify.app/", 
        "http://localhost:5173", 
        "http://localhost:3000",
        "http://localhost",
        "http://127.0.0.1:3000",
        "http://127.0.0.1"
    ],
    
    allow_origin_regex="https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantMiddleware)
app.add_middleware(AuditMiddleware)

# ── Static files (local uploads) ───────────────────────────────────────────────
uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(users.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(resumes.router)
app.include_router(ai.router)
app.include_router(applications.router)
app.include_router(pipeline.router)
app.include_router(interviews.router)
app.include_router(scorecards.router)
app.include_router(offers.router)
app.include_router(analytics.router)
app.include_router(notifications.router)
app.include_router(talent_pool.router)
app.include_router(portal.router)
app.include_router(admin.router)
app.include_router(calendar.router)
app.include_router(invitations.router)
app.include_router(activities.router)
app.include_router(reports.router)


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0", "env": settings.app_env}


@app.get("/health", tags=["health"])
async def health():
    return {"status": "healthy"}
