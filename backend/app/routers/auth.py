"""Authentication API endpoints."""

from datetime import datetime, timedelta
from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.student import Student
from app.models.revoked_token import RevokedToken
from app.schemas.schemas import LoginRequest, TokenResponse, ChangePasswordRequest
from app.services.auth_service import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    decode_token,
    is_token_revoked,
    token_hash,
    security,
)
from app.limiter import limiter
from app.utils.audit import record_audit

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

DUMMY_BCRYPT_HASH = "$2b$12$e8Y4L5K29Zk9PxO1hJ/gYeYw0xNqKjT1hM5bQ3vR9jX9aZ4p6wY8e"


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Find user by username or enrollment_number
    stmt = (
        select(User)
        .where(User.username == req.username)
        .options(selectinload(User.student))
    )
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        # Also check student enrollment_number
        stud_stmt = select(Student).where(Student.enrollment_number == req.username)
        stud_res = await db.execute(stud_stmt)
        student = stud_res.scalar_one_or_none()
        if student:
            user_stmt = select(User).where(User.id == student.user_id)
            user_res = await db.execute(user_stmt)
            user = user_res.scalar_one_or_none()

    now = datetime.utcnow()

    # Check for temporary account lockout
    if user and user.locked_until:
        if user.locked_until > now:
            remaining = int((user.locked_until - now).total_seconds() / 60) + 1
            await record_audit(
                db,
                "LOGIN_LOCKED_ATTEMPT",
                f"user:{user.id}",
                actor_user_id=user.id,
                request=request,
                metadata={"locked_until": user.locked_until.isoformat()},
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Account is temporarily locked due to multiple failed login attempts. Please try again in {remaining} minute(s).",
            )
        else:
            # Lockout expired, reset attempts
            user.locked_until = None
            user.failed_login_attempts = 0

    # User existence / password check with timing attack mitigation
    is_password_valid = False
    if user:
        is_password_valid = verify_password(req.password, user.password_hash)
    else:
        # Equalize execution time with dummy hash check
        verify_password(req.password, DUMMY_BCRYPT_HASH)

    if not user or not is_password_valid:
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            is_now_locked = user.failed_login_attempts >= 5
            if is_now_locked:
                user.locked_until = now + timedelta(minutes=15)
                await record_audit(
                    db,
                    "LOGIN_LOCKED",
                    f"user:{user.id}",
                    actor_user_id=user.id,
                    request=request,
                    metadata={
                        "consecutive_failures": user.failed_login_attempts,
                        "locked": True,
                    },
                )
                await db.commit()
                raise HTTPException(
                    status_code=status.HTTP_423_LOCKED,
                    detail="Account is temporarily locked due to multiple failed login attempts. Please try again in 15 minute(s).",
                )
            await record_audit(
                db,
                "LOGIN_FAILED",
                f"user:{user.id}",
                actor_user_id=user.id,
                request=request,
                metadata={
                    "consecutive_failures": user.failed_login_attempts,
                    "locked": False,
                },
            )
        else:
            await record_audit(
                db,
                "LOGIN_FAILED_UNKNOWN_USER",
                f"username:{req.username}",
                request=request,
            )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/enrollment number or password",
        )

    if not user.is_active:
        await record_audit(
            db,
            "LOGIN_INACTIVE_USER",
            f"user:{user.id}",
            actor_user_id=user.id,
            request=request,
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact the ECE department administrator.",
        )

    # Successful login: reset failed counters and clear lockout
    user.failed_login_attempts = 0
    user.locked_until = None

    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    await record_audit(
        db,
        "LOGIN_SUCCESS",
        f"user:{user.id}",
        actor_user_id=user.id,
        request=request,
    )
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        role=token_data["role"],
        user_id=user.id,
    )


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stud_stmt = select(Student).where(Student.user_id == current_user.id)
    res = await db.execute(stud_stmt)
    student = res.scalar_one_or_none()

    return {
        "id": current_user.id,
        "username": current_user.username,
        "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
        "is_active": current_user.is_active,
        "student": {
            "id": student.id,
            "full_name": student.full_name,
            "enrollment_number": student.enrollment_number,
            "email": student.email,
            "department": student.department,
            "semester": student.semester,
        } if student else None,
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_req: dict,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    token = refresh_req.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing refresh token")

    payload = decode_token(token)
    if await is_token_revoked(token, db):
        await record_audit(
            db,
            "REFRESH_TOKEN_REUSE_DETECTED",
            f"user:{payload.get('sub')}",
            request=request,
        )
        await db.commit()
        raise HTTPException(status_code=401, detail="Refresh token has been revoked or already used")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    res = await db.execute(select(User).where(User.id == int(user_id)))
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    # Invalidate the old refresh token immediately (rotation & reuse protection)
    db.add(RevokedToken(
        token_hash=token_hash(token),
        expires_at=datetime.fromtimestamp(payload["exp"]),
    ))

    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
    }

    new_access_token = create_access_token(token_data)
    new_refresh_token = create_refresh_token(token_data)
    await db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        token_type="bearer",
        role=token_data["role"],
        user_id=user.id,
    )


@router.post("/change-password")
async def change_password(
    data: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """Self-service password change for authenticated users."""
    if not verify_password(data.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    current_user.password_hash = hash_password(data.new_password)
    current_user.failed_login_attempts = 0
    current_user.locked_until = None

    # Revoke current access token
    payload = decode_token(credentials.credentials)
    db.add(RevokedToken(
        token_hash=token_hash(credentials.credentials),
        expires_at=datetime.fromtimestamp(payload["exp"]),
    ))

    await record_audit(
        db,
        "PASSWORD_CHANGED",
        f"user:{current_user.id}",
        actor_user_id=current_user.id,
        request=request,
    )
    await db.commit()
    return {"message": "Password updated successfully. Please log in again with your new password."}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    logout_req: dict = Body(default={}),
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not await is_token_revoked(credentials.credentials, db):
        db.add(RevokedToken(
            token_hash=token_hash(credentials.credentials),
            expires_at=datetime.fromtimestamp(payload["exp"]),
        ))
    refresh_token_val = logout_req.get("refresh_token")
    if refresh_token_val:
        refresh_payload = decode_token(refresh_token_val)
        if refresh_payload.get("type") == "refresh" and not await is_token_revoked(refresh_token_val, db):
            db.add(RevokedToken(
                token_hash=token_hash(refresh_token_val),
                expires_at=datetime.fromtimestamp(refresh_payload["exp"]),
            ))

    if user_id:
        await record_audit(
            db,
            "LOGOUT",
            f"user:{user_id}",
            actor_user_id=int(user_id),
            request=request,
        )
    await db.commit()
