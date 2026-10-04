import sys
from datetime import timedelta

import httpx
import pytest
from httpx import ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

sys.path.insert(0, "backend")

from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.certificate import Certificate  # noqa: E402
from app.models.course import Course, CourseStatus  # noqa: E402
from app.models.enrollment import Enrollment, EnrollmentStatus  # noqa: E402
from app.models.student import Student  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.routers.admin import delete_enrollment  # noqa: E402
from app.services.auth_service import create_access_token, hash_password  # noqa: E402


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture
async def client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with session_factory() as session:
        master = User(username="master", password_hash=hash_password("Master@123"), role=UserRole.MASTER_ADMIN)
        normal = User(username="normal", password_hash=hash_password("Normal@123"), role=UserRole.ADMIN)
        student = User(username="student", password_hash=hash_password("Student@123"), role=UserRole.STUDENT)
        session.add_all([master, normal, student])
        await session.commit()
        await session.refresh(master)
        await session.refresh(normal)
        await session.refresh(student)

    async def override_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = override_db

    def auth(user_id: int):
        token = create_access_token({"sub": str(user_id)}, timedelta(minutes=5))
        return {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as http_client:
        http_client.auth_headers = {  # type: ignore[attr-defined]
            "master": auth(master.id),
            "normal": auth(normal.id),
            "student": auth(student.id),
        }
        yield http_client

    app.dependency_overrides.clear()
    await engine.dispose()


@pytest.mark.anyio
async def test_master_can_create_update_toggle_and_delete_admin(client):
    headers = client.auth_headers["master"]  # type: ignore[attr-defined]
    response = await client.post("/api/addadmins", headers=headers, json={
        "full_name": "New Admin",
        "email": "new@example.com",
        "username": "new-admin",
        "password": "NewAdmin@123",
        "department": "ECE",
    })
    assert response.status_code == 201
    admin_id = response.json()["id"]

    response = await client.put(f"/api/addadmins/{admin_id}", headers=headers, json={"full_name": "Updated Admin"})
    assert response.status_code == 200
    assert response.json()["full_name"] == "Updated Admin"

    response = await client.patch(f"/api/addadmins/{admin_id}/status", headers=headers, json={"is_active": False})
    assert response.status_code == 200
    assert response.json()["is_active"] is False

    response = await client.delete(f"/api/addadmins/{admin_id}", headers=headers)
    assert response.status_code == 204


@pytest.mark.anyio
async def test_non_master_roles_are_forbidden(client):
    for role in ("normal", "student"):
        response = await client.get("/api/addadmins", headers=client.auth_headers[role])  # type: ignore[attr-defined]
        assert response.status_code == 403


@pytest.mark.anyio
async def test_duplicate_username_and_email_are_rejected(client):
    headers = client.auth_headers["master"]  # type: ignore[attr-defined]
    payload = {
        "full_name": "First Admin",
        "email": "duplicate@example.com",
        "username": "duplicate-admin",
        "password": "NewAdmin@123",
    }
    assert (await client.post("/api/addadmins", headers=headers, json=payload)).status_code == 201
    assert (await client.post("/api/addadmins", headers=headers, json={**payload, "email": "other@example.com"})).status_code == 409
    assert (await client.post("/api/addadmins", headers=headers, json={**payload, "username": "other-admin"})).status_code == 409


@pytest.mark.anyio
async def test_last_active_master_cannot_be_deactivated_or_deleted(client):
    headers = client.auth_headers["master"]  # type: ignore[attr-defined]
    response = await client.patch("/api/addadmins/1/status", headers=headers, json={"is_active": False})
    assert response.status_code == 409
    response = await client.delete("/api/addadmins/1", headers=headers)
    assert response.status_code == 400


@pytest.mark.anyio
async def test_inactive_user_cannot_login(client):
    headers = client.auth_headers["master"]  # type: ignore[attr-defined]
    await client.patch("/api/addadmins/2/status", headers=headers, json={"is_active": False})
    response = await client.post("/api/auth/login", json={"username": "normal", "password": "Normal@123"})
    assert response.status_code == 403


@pytest.mark.anyio
async def test_delete_enrollment_removes_stale_certificate_for_reenrollment():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with AsyncSession(engine) as session:
        user = User(
            username="reenroll-user",
            password_hash=hash_password("Pass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)

        student = Student(
            user_id=user.id,
            full_name="Reenroll Student",
            enrollment_number="R2025001",
            email="reenroll@example.com",
        )
        course = Course(
            course_code="REENROLL-101",
            title="Reenrollment Course",
            status=CourseStatus.PUBLISHED,
        )
        session.add_all([student, course])
        await session.commit()
        await session.refresh(student)
        await session.refresh(course)

        enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status=EnrollmentStatus.COMPLETED,
            progress_percentage=100.0,
        )
        cert = Certificate(
            certificate_number="RCT-REENROLL-001",
            student_id=student.id,
            course_id=course.id,
            certificate_file="/certificates/RCT-REENROLL-001.pdf",
            is_revoked=False,
        )
        session.add_all([enrollment, cert])
        await session.commit()
        await session.refresh(enrollment)

        await delete_enrollment(enrollment.id, db=session)

        remaining_cert = await session.get(Certificate, cert.id)
        assert remaining_cert is None

        new_enrollment = Enrollment(
            student_id=student.id,
            course_id=course.id,
            status=EnrollmentStatus.ENROLLED,
            progress_percentage=0.0,
        )
        session.add(new_enrollment)
        await session.commit()
        await session.refresh(new_enrollment)

        assert new_enrollment.id is not None

    await engine.dispose()