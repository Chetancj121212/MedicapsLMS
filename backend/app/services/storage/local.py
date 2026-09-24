"""Local file system storage service implementation."""

import os
import shutil
import uuid
from typing import BinaryIO
from app.config import settings
from app.services.storage.base import StorageService


class LocalStorageService(StorageService):
    def __init__(self, base_dir: str = settings.UPLOAD_DIR):
        self.base_dir = os.path.abspath(base_dir)
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload(self, file_obj: BinaryIO, filename: str, subfolder: str = "videos") -> str:
        target_dir = os.path.join(self.base_dir, subfolder)
        os.makedirs(target_dir, exist_ok=True)

        ext = os.path.splitext(filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(target_dir, unique_name)

        with open(target_path, "wb") as buffer:
            shutil.copyfileobj(file_obj, buffer)

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
