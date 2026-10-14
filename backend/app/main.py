import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.banner import ASCII_BANNER, MAINTAINED_BY, PLAIN_TEXT_RESPONSE, get_landing_html, get_plain_text_response
from app.config import settings
from app.database import init_db, engine, check_database_health, get_database_uptime
from app.limiter import limiter
from app.routers import auth, courses, lectures, quizzes, certificates, students, admin, addadmins

logger = logging.getLogger("lms.main")


def format_uptime(delta: timedelta) -> str:
    """Format a timedelta into a clean, human-readable uptime string (e.g. 2d 4h 12m 5s)."""
    days = delta.days
    hours, remainder = divmod(delta.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts = []
    if days > 0:
        parts.append(f"{days}d")
    if hours > 0 or days > 0:
        parts.append(f"{hours}h")
    parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Record API startup timestamp for real backend uptime tracking
    app.state.backend_started_at = datetime.utcnow()

    # Production startup secret validation
    if settings.ENVIRONMENT == "production":
        insecure_keys = {"replace-with-a-long-random-secret", "secret", "changeme", "admin", "password"}
        if not settings.SECRET_KEY or settings.SECRET_KEY in insecure_keys or len(settings.SECRET_KEY) < 32:
            raise RuntimeError(
                "CRITICAL SECURITY CONFIGURATION ERROR: A strong, random SECRET_KEY (min 32 chars) must be provided in production!"
            )

    # Ensure directories exist
    os.makedirs(os.path.abspath(settings.UPLOAD_DIR), exist_ok=True)
    os.makedirs(os.path.abspath(settings.VIDEO_UPLOAD_DIR), exist_ok=True)
    os.makedirs(os.path.abspath(settings.CERTIFICATE_DIR), exist_ok=True)

    # Initialize database tables
    await init_db()

    # Automatically seed initial courses and accounts if database is empty
    try:
        from sqlalchemy import select, func
        from app.models.course import Course
        from app.database import async_session
        async with async_session() as db:
            course_count = (await db.execute(select(func.count(Course.id)))).scalar_one()
            if course_count == 0:
                logger.info("Empty course catalog detected. Running automatic initial seed...")
                from app.seed import seed
                await seed()
                logger.info("Automatic initial seed completed successfully.")
    except Exception as e:
        logger.warning(f"Initial seed check skipped: {e}")

    yield
    # Graceful shutdown: clean up connection pool (guarded with timeout)
    logger.info("Closing database engine connections on shutdown...")
    try:
        import asyncio
        await asyncio.wait_for(engine.dispose(), timeout=5.0)
    except Exception as exc:
        logger.warning(f"Database engine dispose timed out or failed: {exc}")
    logger.info("Database engine connections closed.")


is_production = settings.ENVIRONMENT == "production"

app = FastAPI(
    title="Medicaps University ECE LMS API",
    description="Backend API for Department of Electronics Engineering, Medicaps University LMS",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
)

# SlowAPI Limiter state & error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Unhandled global 500 error handler (prevents traceback leaks)
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please contact the administrator."},
    )


# Security Headers Middleware
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response: Response = await call_next(request)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com; "
        "img-src 'self' data: https: blob: https://i.ytimg.com https://*.ytimg.com; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://static.cloudflareinsights.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https:; "
        "font-src 'self' data: https: https://fonts.gstatic.com; "
        "connect-src 'self' https: http: ws: wss: https://www.youtube.com https://*.youtube.com https://cloudflareinsights.com https://static.cloudflareinsights.com; "
        "media-src 'self' data: blob: https: http:; "
        "worker-src 'self' blob:; "
        "child-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com https://drive.google.com;"
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# JSON Payload Size Limiter Middleware
@app.middleware("http")
async def limit_json_payload_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    content_type = request.headers.get("content-type", "")
    if content_length and "application/json" in content_type:
        try:
            if int(content_length) > settings.MAX_JSON_BODY_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "JSON payload exceeds maximum allowed size of 10MB."},
                )
        except (ValueError, TypeError):
            pass
    return await call_next(request)


# CORS Middleware - permits configured origins and all localhost ports with credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static file directories for local video streaming and certificates
upload_abs = os.path.abspath(settings.UPLOAD_DIR)
cert_abs = os.path.abspath(settings.CERTIFICATE_DIR)
os.makedirs(upload_abs, exist_ok=True)
os.makedirs(cert_abs, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=upload_abs), name="uploads")
app.mount("/certificates", StaticFiles(directory=cert_abs), name="certificates")

# Include Routers
app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(lectures.router)
app.include_router(quizzes.router)
app.include_router(certificates.router)
app.include_router(students.router)
app.include_router(admin.router)
app.include_router(addadmins.router)


@app.get("/", response_class=HTMLResponse)
async def root(request: Request):
    """Root endpoint displaying minimal Server Alive ASCII banner, uptime, and database status."""
    user_agent = request.headers.get("user-agent", "").lower()
    accept = request.headers.get("accept", "").lower()

    db_ok = await check_database_health()
    db_status = "ONLINE" if db_ok else "OFFLINE"
    db_uptime = await get_database_uptime() if db_ok else "offline"

    started_at = getattr(app.state, "backend_started_at", None)
    backend_uptime = format_uptime(datetime.utcnow() - started_at) if started_at else "just started"

    # JSON requested explicitly
    if "application/json" in accept and "text/html" not in accept:
        return JSONResponse({
            "status": "SERVER ALIVE",
            "database": "connected" if db_ok else "disconnected",
            "database_uptime": db_uptime,
            "backend_uptime": backend_uptime,
            "message": "Medicaps University ECE LMS API is online and operational",
            "maintained_by": MAINTAINED_BY,
            "author": "@chetancj",
            "institution": "Medicaps University",
            "department": "Electronics and Communication Engineering",
            "ascii": ASCII_BANNER,
            "endpoints": {
                "docs": None if is_production else "/docs",
                "redoc": None if is_production else "/redoc",
                "health": "/api/health",
            },
        })

    # CLI / Terminal tools requesting text directly (curl, wget, httpie, powershell)
    if any(agent in user_agent for agent in ("curl", "wget", "httpie", "powershell")) or (
        "text/plain" in accept and "text/html" not in accept
    ):
        banner_text = get_plain_text_response(db_status)
        banner_text += f"\nAPI Uptime: {backend_uptime} | DB Uptime: {db_uptime}\n"
        return PlainTextResponse(
            content=banner_text,
            media_type="text/plain; charset=utf-8",
        )

    # Web browsers / default: Minimal black and white landing page
    return HTMLResponse(content=get_landing_html(db_status=db_status), status_code=200)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Inline SVG favicon for browser tabs."""
    svg_icon = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        '<circle cx="50" cy="50" r="42" fill="#0b0f19" stroke="#10b981" stroke-width="8"/>'
        '<circle cx="50" cy="50" r="20" fill="#10b981"/>'
        '</svg>'
    )
    return Response(content=svg_icon, media_type="image/svg+xml")


@app.get("/api/health")
async def health_check():
    db_ok = await check_database_health()
    db_uptime = await get_database_uptime() if db_ok else "offline"
    started_at = getattr(app.state, "backend_started_at", None)
    backend_uptime = format_uptime(datetime.utcnow() - started_at) if started_at else "just started"
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "database_uptime": db_uptime,
        "backend_uptime": backend_uptime,
        "institution": "Medicaps University",
        "department": "Electronics and Communication Engineering",
    }
