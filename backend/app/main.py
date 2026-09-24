"""Medicaps University ECE LMS — FastAPI Main Application."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.routers import auth, courses, lectures, quizzes, certificates, students, admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure directories exist
    os.makedirs(os.path.abspath(settings.UPLOAD_DIR), exist_ok=True)
    os.makedirs(os.path.abspath(settings.VIDEO_UPLOAD_DIR), exist_ok=True)
    os.makedirs(os.path.abspath(settings.CERTIFICATE_DIR), exist_ok=True)

    # Initialize database tables
    await init_db()
    yield


app = FastAPI(
    title="Medicaps University ECE LMS API",
    description="Backend API for Department of Electronics Engineering, Medicaps University LMS",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins for local dev and Netlify preview
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


@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "institution": "Medicaps University",
        "department": "Electronics and Communication Engineering",
    }
