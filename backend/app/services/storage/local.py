"""Local file system storage service implementation with security controls."""

import os
import uuid
from typing import BinaryIO, Optional
from fastapi import HTTPException, status
from app.config import settings
from app.services.storage.base import StorageService


ALLOWED_EXTENSIONS = {".mp4", ".png", ".jpg", ".jpeg", ".webp", ".pdf"}
DISALLOWED_EXTENSIONS = {".html", ".htm", ".svg", ".js", ".mjs", ".php", ".py", ".sh", ".bat", ".exe"}


def verify_mp4_magic_bytes(header: bytes) -> bool:
    """Verify that file header contains the ISO base media file format / MP4 ftyp box signature."""
    if len(header) < 12:
        return False
    # In MP4/ISOBMFF, the major brand box 'ftyp' is located at byte offset 4-8
    return header[4:8] == b"ftyp"


class LocalStorageService(StorageService):
    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload(
        self,
        file_obj: BinaryIO,
        filename: str,
        subfolder: str = "videos",
        max_size_bytes: Optional[int] = None,
    ) -> str:
        target_dir = os.path.join(self.base_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)

        ext = os.path.splitext(filename)[1].lower()
        if ext in DISALLOWED_EXTENSIONS or ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File extension '{ext}' is not permitted for upload.",
            )

        limit_bytes = max_size_bytes or (settings.MAX_VIDEO_SIZE_MB * 1024 * 1024)
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(target_dir, unique_name)

        total_bytes = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        try:
            with open(target_path, "wb") as buffer:
                while True:
                    chunk = file_obj.read(chunk_size)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > limit_bytes:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Uploaded file exceeds maximum allowed limit of {settings.MAX_VIDEO_SIZE_MB}MB.",
                        )
                    buffer.write(chunk)
        except Exception:
            if os.path.exists(target_path):
                os.remove(target_path)
            raise

        # Store relative path
        rel_path = os.path.join(subfolder, unique_name).replace("\\", "/")
        return f"/uploads/{rel_path}"

    async def delete(self, path: str) -> bool:
        clean_path = path.replace("/uploads/", "")
        full_path = os.path.join(self.base_dir, clean_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                return True
            except OSError:
                return False
        return False

    def get_url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{settings.BASE_URL}{path if path.startswith('/') else '/' + path}"

    def exists(self, path: str) -> bool:
        clean_path = path.replace("/uploads/", "")
        full_path = os.path.join(self.base_dir, clean_path)
        return os.path.exists(full_path)


storage_service = LocalStorageService()
