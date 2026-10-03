"""
Hybent Hiring FastAPI application entry point.
Registers all routers, middleware, static files, and startup events.
"""
import asyncio
import io
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
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

    # LangGraph checkpointer for agent runs (Copilot v2) — only opened when
    # the agent is enabled for someone. Falls back to in-memory on failure,
    # so startup never depends on it.
    from app.services.agents.checkpointer import init_checkpointer, close_checkpointer
    if settings.copilot_agent_v2 or settings.copilot_agent_v2_orgs.strip():
        await init_checkpointer()

    # ── SMTP health check ─────────────────────────────────────────────────────────
    if settings.smtp_user and settings.smtp_password:
        logger.info(
            f"✅ SMTP configured: sending as {settings.email_from_address} "
            f"(login {settings.smtp_user} via {settings.smtp_host}:{settings.smtp_port})"
        )
        if settings.smtp_user.lower() != settings.email_from_address.lower() and not settings.resend_api_key:
            logger.warning(
                f"⚠️  SMTP login {settings.smtp_user} differs from EMAIL_FROM_ADDRESS {settings.email_from_address}. "
                "Unless that account may send as it (e.g. a verified Gmail 'Send mail as' alias), "
                "the provider will rewrite the From or recipients may flag the mail as spam."
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
    await close_checkpointer()
    
    logger.info("Hybent Hiring API shutting down")


# Charge every Gemini call to the org/user in scope (app/services/ai_metering.py).
from app.services.ai_metering import install_gemini_metering  # noqa: E402
install_gemini_metering()

app = FastAPI(
    title="Hybent Hiring API",
    description="AI-powered recruitment automation platform",
    version="1.0.0",
    lifespan=lifespan,
    # The interactive docs map every endpoint for anyone who finds them, so
    # they are only served outside production.
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
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
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
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
    return APIResponse.error(message="An unexpected system error occurred. Please try again later.", status_code=500)

# ── Middleware ─────────────────────────────────────────────────────────────────
class _GZipExceptStreams(GZipMiddleware):
    """Gzip everything except Server-Sent Events. Starlette 0.37's gzip holds
    a streamed body in the compressor until the stream ends, so the Copilot's
    live steps and tokens all reached the browser at once."""

    STREAM_PATHS = ("/v1/copilot/chat",)

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope.get("path", "").rstrip("/") in self.STREAM_PATHS:
            await self.app(scope, receive, send)
            return
        await super().__call__(scope, receive, send)


app.add_middleware(_GZipExceptStreams, minimum_size=1024)
app.add_middleware(TenantMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(RateLimiterMiddleware, auth_limit=30, api_limit=120, window_seconds=60)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://hybent.com",
        "http://hybent.com",
        "https://www.hybent.com",
        "http://www.hybent.com",
        "https://app.hybent.com",
        "http://app.hybent.com",
        "https://hybent-hiring-backend.onrender.com",
        "https://gethybent_hiring.netlify.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost",
        "http://127.0.0.1:3000",
        "http://127.0.0.1"
    ],
    allow_origin_regex=r"^https?://([a-zA-Z0-9-]+\.)*hybent\.com$|^https?://localhost(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# ── Static files (local uploads) & Ephemeral Fallbacks ────────────────────────
uploads_path = Path(settings.upload_dir)
uploads_path.mkdir(exist_ok=True)

RESUME_FALLBACK_HTML = """
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {{ margin: 2cm; }}
  body {{ font-family: 'Helvetica', 'Arial', sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.5; }}
  .name {{ font-size: 20pt; font-weight: bold; color: #0f172a; margin-bottom: 4px; }}
  .title {{ font-size: 12pt; color: #2563eb; margin-bottom: 12px; font-weight: bold; }}
  .contact {{ font-size: 10pt; color: #64748b; margin-bottom: 20px; border-bottom: 1.5pt solid #cbd5e1; padding-bottom: 10px; }}
  h3 {{ font-size: 12pt; font-weight: bold; color: #0f172a; border-bottom: 1pt solid #cbd5e1; padding-bottom: 4px; margin-top: 20px; margin-bottom: 10px; }}
  .section {{ margin-bottom: 18px; }}
  .paragraph {{ margin: 0 0 10px 0; text-align: justify; color: #334155; }}
  .skill-tag {{ display: inline-block; background-color: #eff6ff; color: #1d4ed8; padding: 4px 10px; border-radius: 4px; margin: 3px; font-size: 9.5pt; font-weight: bold; border: 0.5pt solid #bfdbfe; }}
  .footer {{ position: fixed; bottom: -1cm; left: 0; right: 0; text-align: center; font-size: 8.5pt; color: #94a3b8; border-top: 0.5pt solid #f1f5f9; padding-top: 6px; }}
</style>
</head>
<body>
  <div class="name">{full_name}</div>
  <div class="title">{title}</div>
  <div class="contact">Email: {email} &bull; Location: {location} &bull; Experience: {experience}</div>

  {summary_section}

  <div class="section">
    <h3>Key Technical Skills</h3>
    <div>{skills_html}</div>
  </div>

  <div class="footer">
    Hybent Hiring Candidate Document &bull; {full_name}
  </div>
</body>
</html>
"""

@app.get("/static/uploads/resumes/{org_id}/{filename}")
@app.get("/static/uploads/resumes/{filename}")
async def serve_or_fallback_resume(filename: str, org_id: str = ""):
    """Serve uploaded resume file from disk if present, or generate a fallback candidate PDF if missing on ephemeral cloud instances."""
    from fastapi import HTTPException
    
    # Sanitize path variables to prevent path traversal
    clean_filename = Path(filename).name
    clean_org_id = Path(org_id).name if org_id else ""
    
    if clean_org_id:
        file_path = (uploads_path / "resumes" / clean_org_id / clean_filename).resolve()
    else:
        file_path = (uploads_path / "resumes" / clean_filename).resolve()
        
    # Ensure resolved path is under the base uploads path
    if not file_path.is_relative_to(uploads_path.resolve()):
        raise HTTPException(status_code=400, detail="Invalid file path")
        
    if file_path.exists():
        return FileResponse(
            file_path, 
            media_type="application/pdf", 
            headers={"Content-Disposition": f"attachment; filename={clean_filename}"}
        )

    candidate = None
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.candidate import Candidate
        from sqlalchemy import select
        async with AsyncSessionLocal() as session:
            res = await session.execute(select(Candidate).where(Candidate.resume_url.like(f"%{filename}%")))
            candidate = res.scalar_one_or_none()
    except Exception as exc:
        logger.warning(f"Failed to lookup candidate for resume fallback: {exc}")

    import html
    full_name = html.escape(candidate.full_name) if candidate else "Candidate Profile"
    email = html.escape(candidate.email) if candidate else "applicant@hybent.com"
    title = html.escape(candidate.current_title or "Software Professional") if candidate else "Professional"
    location = html.escape(candidate.location or "Remote / Office") if candidate else "N/A"
    exp = html.escape(f"{candidate.years_experience} years") if (candidate and candidate.years_experience) else "3+ years"
    summary = html.escape(candidate.summary) if (candidate and candidate.summary) else "Experienced professional skilled in software engineering, technical architecture, and collaboration."
    skills = [html.escape(s) for s in candidate.skills] if (candidate and candidate.skills) else ["Python", "FastAPI", "React", "TypeScript", "SQL"]

    skills_html = "".join([f'<span class="skill-tag">{s}</span>' for s in skills])
    summary_html = f'<div class="section"><h3>Professional Summary</h3><div class="paragraph">{summary}</div></div>' if summary else ''

    html_content = RESUME_FALLBACK_HTML.format(
        full_name=full_name,
        title=title,
        email=email,
        location=location,
        experience=exp,
        summary_section=summary_html,
        skills_html=skills_html
    )

    buf = io.BytesIO()
    try:
        from xhtml2pdf import pisa
        pisa.CreatePDF(html_content, dest=buf)
        pdf_bytes = buf.getvalue()
    except Exception as pdf_err:
        logger.error(f"Fallback resume PDF generation failed: {pdf_err}")
        pdf_bytes = b"%PDF-1.4 Fallback Resume"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={filename}"}
    )

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
