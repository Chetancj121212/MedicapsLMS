"""Application configuration loaded from environment variables."""

from pathlib import Path
from pydantic_settings import BaseSettings
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

    # Application
    BASE_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = '["http://localhost:3000"]'

    @property
    def cors_origins_list(self) -> List[str]:
        return json.loads(self.CORS_ORIGINS)

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        database_path = Path(self.DATA_DIR).resolve() / "lms.db"
        return f"sqlite+aiosqlite:///{database_path.as_posix()}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
