"""Abstract base class for storage service."""

from abc import ABC, abstractmethod
from typing import BinaryIO, Optional


class StorageService(ABC):
    @abstractmethod
    async def upload(self, file_obj: BinaryIO, filename: str, subfolder: str = "videos") -> str:
        """Uploads a file and returns its relative or accessible storage path/url."""
        pass

    @abstractmethod
    async def delete(self, path: str) -> bool:
        """Deletes a file given its storage path."""
        pass

    @abstractmethod
    def get_url(self, path: str) -> str:
        """Returns the public or streamable URL for the given path."""
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        """Checks if a file exists."""
        pass
