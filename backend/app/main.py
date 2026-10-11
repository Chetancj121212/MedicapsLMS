import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from app.banner import ASCII_BANNER, MAINTAINED_BY, PLAIN_TEXT_RESPONSE, get_landing_html, get_plain_text_response
from app.config import settings
from app.database import init_db, engine, check_database_health
from app.routers import auth, courses, lectures, quizzes, certificates, students, admin, addadmins

logger = logging.getLogger("lms.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
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


app = FastAPI(
    title="Medicaps University ECE LMS API",
    description="Backend API for Department of Electronics Engineering, Medicaps University LMS",
    version="1.0.0",
    lifespan=lifespan,
)

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
    """Root endpoint displaying minimal Server Alive ASCII banner and database status."""
    user_agent = request.headers.get("user-agent", "").lower()
    accept = request.headers.get("accept", "").lower()

    db_ok = await check_database_health()
    db_status = "ONLINE" if db_ok else "OFFLINE"

    # JSON requested explicitly
    if "application/json" in accept and "text/html" not in accept:
        return JSONResponse({
            "status": "SERVER ALIVE",
            "database": "connected" if db_ok else "disconnected",
            "message": "Medicaps University ECE LMS API is online and operational",
            "maintained_by": MAINTAINED_BY,
            "author": "@chetancj",
            "institution": "Medicaps University",
            "department": "Electronics and Communication Engineering",
            "ascii": ASCII_BANNER,
            "endpoints": {
                "docs": "/docs",
                "redoc": "/redoc",
                "health": "/api/health",
            },
        })

    # CLI / Terminal tools requesting text directly (curl, wget, httpie, powershell)
    if any(agent in user_agent for agent in ("curl", "wget", "httpie", "powershell")) or (
        "text/plain" in accept and "text/html" not in accept
    ):
        return PlainTextResponse(
            content=get_plain_text_response(db_status),
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
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "institution": "Medicaps University",
        "department": "Electronics and Communication Engineering",
    }

