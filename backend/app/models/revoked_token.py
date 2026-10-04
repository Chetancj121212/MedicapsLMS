"""Server-side JWT revocation records used by logout."""

from datetime import datetime
from sqlalchemy import Column, DateTime, Integer, String
from app.database import Base


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False, index=True)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)