"""
Hybent Hiring FastAPI application entry point.
Registers all routers, middleware, static files, and startup events.
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.utils.exceptions import InsufficientCreditsException

from app.schemas.response import APIResponse
from app.core.config import settings
from app.core.database import engine
from app.websocket.manager import ws_manager
from app.middleware.audit import AuditMiddleware
from app.middleware.tenant import TenantMiddleware
from app.middleware.rate_limiter import RateLimiterMiddleware
from app.services import elasticsearch_service as es_service
import app.models  # noqa: F401 — register all models with Base
from app.routers.api import api_router
# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown events."""
    logger.info(f"🚀 Hybent Hiring API starting in {settings.app_env} mode")

    # Always run Alembic migrations on startup to ensure Render DB is up to date
    # This fixes issues where Render Native environments don't run entrypoint.sh
    try:
        from alembic import command
        from alembic.config import Config
        def run_migrations():
            alembic_cfg = Config("alembic.ini")
            command.upgrade(alembic_cfg, "head")
            
        await asyncio.to_thread(run_migrations)
        logger.info("Successfully applied Alembic migrations.")
    except Exception as e:
        logger.warning(f"Alembic migration skipped or failed (likely concurrent): {e}")

    # Ensure upload directories exist
    Path(settings.upload_dir).mkdir(exist_ok=True)
    for sub in ["resumes", "jds", "offers", "avatars", "pre-screening"]:
        Path(settings.upload_dir, sub).mkdir(exist_ok=True)
        
    # Start Redis Pub/Sub listener for WebSockets
    redis_listener_task = asyncio.create_task(ws_manager.listen_to_redis())
    logger.info("Redis WS listener task created.")

    # Setup Elasticsearch indices (non-blocking — warns if ES unavailable)
    try:
        await es_service.setup_indices()
        logger.info("Elasticsearch indices ready.")
    except Exception as exc:
        logger.warning(f"Elasticsearch setup skipped: {exc}")

    # ── SMTP health check ─────────────────────────────────────────────────────────
    if settings.smtp_user and settings.smtp_password:
        logger.info(
            f"✅ SMTP configured: {settings.smtp_user} "
            f"via {settings.smtp_host}:{settings.smtp_port}"
        )
    else:
        logger.warning(
            "⚠️  SMTP not configured — SMTP_USER or SMTP_PASSWORD is missing from env.\n"
            "  Emails will print to console only. Set credentials in .env to enable delivery."
        )

    yield
    
    # Clean up
    redis_listener_task.cancel()
    try:
        await redis_listener_task
    except asyncio.CancelledError:
        logger.info("Redis WS listener task cancelled.")

    # Close ES client
    await es_service.close()
    
    logger.info("Hybent Hiring API shutting down")


app = FastAPI(
    title="Hybent Hiring API",
    description="AI-powered recruitment automation platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

perf_logger = logging.getLogger("api_performance")

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.perf_counter()
    response = await call_next(request)
    process_time = time.perf_counter() - start_time
    perf_logger.info(
        f"{request.method} {request.url.path} "
        f"Status={response.status_code} "
        f"Time={process_time:.3f}s"
    )
    
    # Prevent browser caching of API responses (especially GET requests)
    path = request.url.path
    if path.startswith("/v1/") or path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    # Production security headers
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: https:; "
        "font-src 'self' data: https://cdn.jsdelivr.net; "
        "connect-src 'self' https:;"
    )
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
    return response


@app.exception_handler(InsufficientCreditsException)
async def insufficient_credits_handler(request: Request, exc: InsufficientCreditsException):
    return APIResponse.error(message=exc.message, status_code=403)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict):
        msg = exc.detail.get("message", "An error occurred")
        details = {k: v for k, v in exc.detail.items() if k != "message"}
        return APIResponse.error(message=msg, status_code=exc.status_code, details=details)
    return APIResponse.error(message=str(exc.detail), status_code=exc.status_code)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    cleaned_errors = []
    for err in errors:
        cleaned_err = dict(err)
        if "ctx" in cleaned_err and isinstance(cleaned_err["ctx"], dict):
            cleaned_err["ctx"] = {
                k: str(v) if isinstance(v, Exception) else v
                for k, v in cleaned_err["ctx"].items()
            }
        cleaned_errors.append(cleaned_err)
    logger.error(f"422 Validation error on {request.method} {request.url}: {cleaned_errors}")
    return APIResponse.error(message="There was an issue with the submitted data.", status_code=422, details={"errors": cleaned_errors})

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled exception on {request.method} {request.url}: {exc}")
    return APIResponse.error(message="An unexpected system error occurred. Please try again later.", status_code=500, details={"error": str(exc)})

# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,          # Pulled from FRONTEND_URL env var (production domain)
        "https://hybent.com",           # Production domain
        "https://www.hybent.com",       # Production domain with www
        "https://app.hybent.com",       # App portal domain
        "https://gethybent_hiring.netlify.app", # Netlify deployment domain
        "http://localhost:5173",         # Vite dev server
        "http://localhost:3000",         # Docker local frontend
        "http://localhost",
        "http://127.0.0.1:3000",
        "http://127.0.0.1"
    ],
    allow_origin_regex=r"https://.*\.hybent\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(TenantMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimiterMiddleware, auth_limit=10, api_limit=120, window_seconds=60)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Enforce HTTPS redirect in production if request is HTTP
    if settings.is_production and request.headers.get("x-forwarded-proto") == "http":
        url = request.url.replace(scheme="https")
        return JSONResponse(status_code=307, headers={"Location": str(url)}, content=None)
    
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# ── Static files (local uploads) ───────────────────────────────────────────────
uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(api_router)


@app.get("/", tags=["health"])
async def root():
    return {"status": "ok", "app": settings.app_name, "version": "1.0.0", "env": settings.app_env}


@app.get("/health", tags=["health"])
async def health():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": "1.0.0",
        "env": settings.app_env
    }


@app.get("/health/db", tags=["health"])
async def health_db():
    """Readiness check for database connectivity."""
    from sqlalchemy import text

    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.exception("Database health check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "database": "down", "error": str(exc)},
        )
    return {"status": "healthy", "database": "ok"}


@app.get("/ready", tags=["health"])
async def ready():
    """Production readiness check for API, DB, and critical candidate-import schema."""
    from sqlalchemy import text

    required_candidate_columns = {
        "import_batch_id",
        "imported_by_id",
        "imported_at",
        "import_status",
    }
    required_import_batch_columns = {"file_content"}

    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            candidate_rows = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'candidates'"
            ))
            batch_rows = await conn.execute(text(
                "SELECT column_name FROM information_schema.columns WHERE table_name = 'import_batches'"
            ))
    except Exception as exc:
        logger.exception("Readiness check failed: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"status": "unready", "database": "down", "error": str(exc)},
        )

    candidate_columns = {row[0] for row in candidate_rows}
    import_batch_columns = {row[0] for row in batch_rows}
    missing_candidate_columns = sorted(required_candidate_columns - candidate_columns)
    missing_import_batch_columns = sorted(required_import_batch_columns - import_batch_columns)

    if missing_candidate_columns or missing_import_batch_columns:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unready",
                "database": "ok",
                "missing_candidate_columns": missing_candidate_columns,
                "missing_import_batch_columns": missing_import_batch_columns,
            },
        )

    return {"status": "ready", "database": "ok", "schema": "ok"}
