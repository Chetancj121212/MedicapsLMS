"""Master Admin API for managing administrator accounts."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.audit import AuditLog
from app.models.user import User, UserRole
from app.schemas.schemas import AdminCreate, AdminResponse, AdminStatusUpdate, AdminUpdate
from app.services.auth_service import hash_password, require_master_admin

router = APIRouter(
    prefix="/api/addadmins",
    tags=["Master Admin"],
    dependencies=[Depends(require_master_admin)],
)


def role_name(user: User) -> str:
    return user.role.value if hasattr(user.role, "value") else str(user.role)


def admin_response(user: User) -> AdminResponse:
    return AdminResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        username=user.username,
        department=user.department,
        role=role_name(user),
        is_active=user.is_active,
        created_at=user.created_at,
    )


async def ensure_unique(db: AsyncSession, username: Optional[str], email: Optional[str], exclude_id: Optional[int] = None):
    predicates = []
    if username:
        predicates.append(User.username == username)
    if email:
        predicates.append(User.email == email)
    if not predicates:
        return

    stmt = select(User).where(or_(*predicates))
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    existing = (await db.execute(stmt)).scalars().first()
    if existing:
        if username and existing.username == username:
            raise HTTPException(status_code=409, detail="Username already exists")
        raise HTTPException(status_code=409, detail="Email already exists")


async def write_audit(db: AsyncSession, actor: User, action: str, user_id: int, metadata: Optional[dict] = None):
    db.add(AuditLog(
        actor_user_id=actor.id,
        action=action,
        affected_record=f"user:{user_id}",
        metadata_json=metadata or {},
    ))


@router.post("", response_model=AdminResponse, status_code=status.HTTP_201_CREATED)
async def create_admin(
    data: AdminCreate,
    current_user: User = Depends(require_master_admin),
    db: AsyncSession = Depends(get_db),
):
    await ensure_unique(db, data.username, str(data.email))
    user = User(
        full_name=data.full_name.strip(),
        email=str(data.email).lower(),
        username=data.username.strip(),
        password_hash=hash_password(data.password),
        department=data.department,
        role=UserRole.ADMIN,
        is_active=data.is_active,
    )
    db.add(user)
    await db.flush()
    await write_audit(db, current_user, "ADMIN_CREATED", user.id, {"username": user.username})
    return admin_response(user)


@router.get("", response_model=list[AdminResponse])
async def list_admins(
    search: Optional[str] = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.role.in_([
        UserRole.MASTER_ADMIN,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
        UserRole.DEPARTMENT_ADMIN,
        UserRole.COURSE_INSTRUCTOR,
    ])).order_by(User.created_at.desc())
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(User.full_name.ilike(term), User.email.ilike(term), User.username.ilike(term)))
    users = (await db.execute(stmt)).scalars().all()
    return [admin_response(user) for user in users]


async def get_admin_or_404(admin_id: int, db: AsyncSession) -> User:
    user = (await db.execute(select(User).where(User.id == admin_id))).scalar_one_or_none()
    if not user or user.role == UserRole.STUDENT:
        raise HTTPException(status_code=404, detail="Admin not found")
    return user


@router.get("/{admin_id}", response_model=AdminResponse)
async def get_admin(admin_id: int, db: AsyncSession = Depends(get_db)):
    return admin_response(await get_admin_or_404(admin_id, db))


@router.put("/{admin_id}", response_model=AdminResponse)
async def update_admin(
    admin_id: int,
    data: AdminUpdate,
    current_user: User = Depends(require_master_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await get_admin_or_404(admin_id, db)
    updates = data.model_dump(exclude_unset=True)
    if "username" in updates:
        updates["username"] = updates["username"].strip()
    if "email" in updates and updates["email"] is not None:
        updates["email"] = str(updates["email"]).lower()
    await ensure_unique(db, updates.get("username"), updates.get("email"), admin_id)
    for key, value in updates.items():
        setattr(user, key, value.strip() if isinstance(value, str) and key != "email" else value)
    await write_audit(db, current_user, "ADMIN_UPDATED", user.id, {"fields": sorted(updates.keys())})
    return admin_response(user)


@router.patch("/{admin_id}/status", response_model=AdminResponse)
async def update_admin_status(
    admin_id: int,
    data: AdminStatusUpdate,
    current_user: User = Depends(require_master_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await get_admin_or_404(admin_id, db)
    if user.role in (UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN) and not data.is_active:
        active_masters = (await db.execute(select(func.count(User.id)).where(
            User.role.in_([UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN]),
            User.is_active.is_(True),
        ))).scalar_one()
        if active_masters <= 1:
            raise HTTPException(status_code=409, detail="The last active Master Admin cannot be deactivated")
    if user.id == current_user.id and not data.is_active:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = data.is_active
    await write_audit(db, current_user, "ADMIN_DEACTIVATED" if not data.is_active else "ADMIN_ACTIVATED", user.id)
    return admin_response(user)


@router.delete("/{admin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_admin(
    admin_id: int,
    current_user: User = Depends(require_master_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await get_admin_or_404(admin_id, db)
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    if user.role in (UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN) and user.is_active:
        active_masters = (await db.execute(select(func.count(User.id)).where(
            User.role.in_([UserRole.MASTER_ADMIN, UserRole.SUPER_ADMIN]),
            User.is_active.is_(True),
        ))).scalar_one()
        if active_masters <= 1:
            raise HTTPException(status_code=409, detail="The last active Master Admin cannot be deleted")
    await write_audit(db, current_user, "ADMIN_DELETED", user.id, {"username": user.username})
    await db.delete(user)