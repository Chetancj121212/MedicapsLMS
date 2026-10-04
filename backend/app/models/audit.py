"""Security-relevant administrative audit events."""

from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    action = Column(String(100), nullable=False, index=True)
    affected_record = Column(String(200), nullable=False)
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)