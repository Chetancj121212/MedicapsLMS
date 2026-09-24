"""Authentication API endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User
from app.models.student import Student
from app.schemas.schemas import LoginRequest, TokenResponse, UserResponse
from app.services.auth_service import (
    verify_password,
    create_access_token,
    create_refresh_token,
    get_current_user,
    decode_token,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
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

    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/enrollment number or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Contact the ECE department administrator.",
        )

    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

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
async def refresh_token(refresh_req: dict, db: AsyncSession = Depends(get_db)):
    token = refresh_req.get("refresh_token")
    if not token:
        raise HTTPException(status_code=400, detail="Missing refresh token")

    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    res = await db.execute(select(User).where(User.id == int(user_id)))
    user = res.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    token_data = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role.value if hasattr(user.role, "value") else str(user.role),
    }

    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
        token_type="bearer",
        role=token_data["role"],
        user_id=user.id,
    )
