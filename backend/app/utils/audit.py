"""Unified security audit logging utility."""

from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.audit import AuditLog


async def record_audit(
    db: AsyncSession,
    action: str,
    affected_record: str,
    actor_user_id: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
    request: Optional[Request] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Record a security-relevant event to the unified audit_logs table."""
    client_ip = ip_address
    client_ua = user_agent
    if request:
        if not client_ip:
            client_ip = request.headers.get("x-forwarded-for") or (
                request.client.host if request.client else None
            )
            if client_ip and "," in client_ip:
                client_ip = client_ip.split(",")[0].strip()
        if not client_ua:
            client_ua = request.headers.get("user-agent")

    db.add(AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        affected_record=affected_record,
        ip_address=client_ip[:45] if client_ip else None,
        user_agent=client_ua[:500] if client_ua else None,
        metadata_json=metadata or {},
        created_at=datetime.utcnow(),
    ))
