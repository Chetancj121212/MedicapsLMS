"""Application configuration loaded from environment variables."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import json


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_DIR = PROJECT_ROOT / "data"


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = ""
    DATA_DIR: str = str(DEFAULT_DATA_DIR)

    # JWT
    SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Storage
    UPLOAD_DIR: str = str(DEFAULT_DATA_DIR / "uploads")
    VIDEO_UPLOAD_DIR: str = str(DEFAULT_DATA_DIR / "uploads" / "videos")
    CERTIFICATE_DIR: str = str(DEFAULT_DATA_DIR / "certificates")
    MAX_VIDEO_SIZE_MB: int = 500

    BASE_URL: str = "https://apimedicapslms.chetancj.in"
    FRONTEND_URL: str = "https://medicapslms.chetancj.in"
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> List[str]:
        origins = set()
        if self.CORS_ORIGINS:
            raw = self.CORS_ORIGINS.strip()
            if raw.startswith("[") and raw.endswith("]"):
                try:
                    for item in json.loads(raw):
                        if item:
                            origins.add(str(item).strip())
                except Exception:
                    pass
            else:
                for item in raw.split(","):
                    if item.strip():
                        origins.add(item.strip())
        if self.FRONTEND_URL:
            origins.add(self.FRONTEND_URL.strip().rstrip("/"))
        origins.add("http://localhost:3000")
        origins.add("http://127.0.0.1:3000")
        origins.add("https://apimedicapslms.chetancj.in")
        origins.add("https://medicapslms.chetancj.in")
        return list(origins)

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql+asyncpg://", 1)
            elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        # Detect if running inside a Docker container
        in_docker = Path("/.dockerenv").exists()
        host = "db" if in_docker else "localhost"
        return f"postgresql+asyncpg://postgres:postgres@{host}:5432/medicaps_lms"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
