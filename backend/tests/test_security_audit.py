import pytest
from datetime import datetime, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from pydantic import ValidationError

from app.database import Base, get_db
from app.main import app
from app.limiter import limiter
from app.models.user import User, UserRole
from app.models.student import Student
from app.models.course import Course, CourseStatus
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.certificate import Certificate
from app.schemas.schemas import AdminCreate, StudentCreate
from app.services.auth_service import hash_password, create_access_token, create_refresh_token

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def override_get_db():
    async with TestingSessionLocal() as session:
        try:
            yield session
            if session.is_active:
                await session.commit()
        except Exception:
            if session.is_active:
                await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def setup_db():
    try:
        limiter.reset()
    except Exception:
        pass
    app.dependency_overrides[get_db] = override_get_db
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# 1. Strong Password Policy Validation Tests
# ---------------------------------------------------------------------------

def test_password_policy_admin_create():
    # Valid strong password
    payload = {
        "username": "prof_ece",
        "full_name": "Prof ECE",
        "email": "prof@medicaps.ac.in",
        "password": "StrongPassword@123",
    }
    schema = AdminCreate(**payload)
    assert schema.password == "StrongPassword@123"

    # Weak passwords (short, no uppercase, no digit)
    with pytest.raises(ValidationError):
        AdminCreate(**{**payload, "password": "short"})

    with pytest.raises(ValidationError):
        AdminCreate(**{**payload, "password": "lowercaseonly123!"})

    with pytest.raises(ValidationError):
        AdminCreate(**{**payload, "password": "UPPERCASEONLY123!"})

    with pytest.raises(ValidationError):
        AdminCreate(**{**payload, "password": "NoDigitsOrSpecialChars"})


def test_password_policy_student_create():
    payload = {
        "username": "EN22EC001",
        "full_name": "Student Test",
        "email": "student@medicaps.ac.in",
        "enrollment_number": "EN22EC001",
        "department": "ECE",
        "password": "Medicaps@2026!ECE",
    }
    schema = StudentCreate(**payload)
    assert schema.password == "Medicaps@2026!ECE"

    # Weak password
    with pytest.raises(ValidationError):
        StudentCreate(**{**payload, "password": "123"})


# ---------------------------------------------------------------------------
# 2. Account Lockout & User Enumeration Protection
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_account_lockout_after_failed_logins():
    async with TestingSessionLocal() as db:
        user = User(
            username="lockout_victim",
            password_hash=hash_password("CorrectPassword@123"),
            role=UserRole.STUDENT,
            is_active=True,
            failed_login_attempts=0,
        )
        db.add(user)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 4 consecutive bad attempts
        for i in range(4):
            res = await client.post("/api/auth/login", json={"username": "lockout_victim", "password": "WrongPassword@123"})
            assert res.status_code == 401

        # 5th bad attempt -> locks account immediately with 423
        res = await client.post("/api/auth/login", json={"username": "lockout_victim", "password": "WrongPassword@123"})
        assert res.status_code == 423
        assert "locked" in res.json()["detail"].lower()

        # Reset limiter before checking subsequent attempt
        limiter.reset()

        # Subsequent attempt -> locked with 423
        res = await client.post("/api/auth/login", json={"username": "lockout_victim", "password": "CorrectPassword@123"})
        assert res.status_code == 423
        assert "locked" in res.json()["detail"].lower()


@pytest.mark.anyio
async def test_user_enumeration_prevention():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Non-existent user
        res = await client.post("/api/auth/login", json={"username": "ghost_user", "password": "SomePassword@123"})
        assert res.status_code == 401
        assert res.json()["detail"] == "Incorrect username/enrollment number or password"


# ---------------------------------------------------------------------------
# 3. Rate Limiting Protection
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_rate_limiting_login_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        statuses = []
        # Endpoint limit is 5 per 1 minute
        for _ in range(7):
            res = await client.post("/api/auth/login", json={"username": "random_user", "password": "Password@123"})
            statuses.append(res.status_code)

        # 429 should be triggered after limit exceeded
        assert 429 in statuses


# ---------------------------------------------------------------------------
# 4. Refresh Token Rotation & Revocation
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_refresh_token_rotation_and_revocation():
    async with TestingSessionLocal() as db:
        user = User(
            username="refresh_user",
            password_hash=hash_password("SecretPass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    old_refresh_token = create_refresh_token({"sub": str(user.id)})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First refresh succeeds
        res = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh_token})
        assert res.status_code == 200
        new_data = res.json()
        assert "access_token" in new_data
        assert "refresh_token" in new_data
        new_refresh_token = new_data["refresh_token"]
        assert new_refresh_token != old_refresh_token

        # Second refresh using old refresh token fails (token has been revoked / rotated)
        res_reuse = await client.post("/api/auth/refresh", json={"refresh_token": old_refresh_token})
        assert res_reuse.status_code == 401


# ---------------------------------------------------------------------------
# 5. Enrollment IDOR Checks
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_idor_protection_un_enrolled_student():
    async with TestingSessionLocal() as db:
        user = User(
            username="student_idor",
            password_hash=hash_password("SecretPass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        student = Student(user_id=user.id, full_name="Student IDOR", enrollment_number="EN22EC999")
        course = Course(title="Restricted Course", course_code="EC999", status=CourseStatus.PUBLISHED)
        db.add_all([student, course])
        await db.commit()
        await db.refresh(student)
        await db.refresh(course)

        module = Module(course_id=course.id, title="Module 1", order_index=1)
        db.add(module)
        await db.commit()
        await db.refresh(module)

        lecture = Lecture(module_id=module.id, title="Secret Lecture", duration=60.0, order_index=1)
        quiz = Quiz(module_id=module.id, title="Secret Quiz", order_index=1)
        db.add_all([lecture, quiz])
        await db.commit()
        await db.refresh(lecture)
        await db.refresh(quiz)

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # GET /api/courses/{course_id}/learn -> 403
        res = await client.get(f"/api/courses/{course.id}/learn", headers=headers)
        assert res.status_code == 403

        # GET /api/courses/{course_id}/eligibility -> 403
        res = await client.get(f"/api/courses/{course.id}/eligibility", headers=headers)
        assert res.status_code == 403

        # POST /api/lectures/{lecture_id}/progress -> 403
        res = await client.post(
            f"/api/lectures/{lecture.id}/progress",
            headers=headers,
            json={"watched_seconds": 10.0, "active_screen_time_seconds": 10.0},
        )
        assert res.status_code == 403

        # GET /api/quizzes/{quiz_id} -> 403
        res = await client.get(f"/api/quizzes/{quiz.id}", headers=headers)
        assert res.status_code == 403

        # POST /api/quizzes/{quiz_id}/submit -> 403
        res = await client.post(f"/api/quizzes/{quiz.id}/submit", headers=headers, json={"answers": []})
        assert res.status_code == 403


# ---------------------------------------------------------------------------
# 6. Sequential Unlocking & Video URL Masking
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_sequential_course_unlocking_and_masking():
    async with TestingSessionLocal() as db:
        user = User(
            username="student_seq",
            password_hash=hash_password("SecretPass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        student = Student(user_id=user.id, full_name="Student Seq", enrollment_number="EN22EC888")
        course = Course(title="Sequential Course", course_code="EC888", status=CourseStatus.PUBLISHED)
        db.add_all([student, course])
        await db.commit()
        await db.refresh(student)
        await db.refresh(course)

        enrollment = Enrollment(student_id=student.id, course_id=course.id, status=EnrollmentStatus.ENROLLED)
        module = Module(course_id=course.id, title="Module 1", order_index=1)
        db.add_all([enrollment, module])
        await db.commit()
        await db.refresh(module)

        lec1 = Lecture(
            module_id=module.id,
            title="Lecture 1",
            duration=60.0,
            order_index=1,
            video_path="/uploads/lec1.mp4",
            video_source_url="https://youtube.com/watch?v=111",
            video_id="111",
        )
        lec2 = Lecture(
            module_id=module.id,
            title="Lecture 2",
            duration=60.0,
            order_index=2,
            video_path="/uploads/lec2.mp4",
            video_source_url="https://youtube.com/watch?v=222",
            video_id="222",
        )
        db.add_all([lec1, lec2])
        await db.commit()
        await db.refresh(lec1)
        await db.refresh(lec2)

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Check curriculum status via /learn
        res = await client.get(f"/api/courses/{course.id}/learn", headers=headers)
        assert res.status_code == 200
        curriculum = res.json()
        modules = curriculum["modules"]
        items = modules[0]["items"]

        # Lecture 1 should be unlocked
        assert items[0]["is_locked"] is False
        assert items[0]["video_path"] == "/uploads/lec1.mp4"

        # Lecture 2 should be locked and its URLs masked
        assert items[1]["is_locked"] is True
        assert items[1]["video_path"] is None
        assert items[1]["video_source_url"] is None
        assert items[1]["video_id"] is None

        # Attempting progress on locked lecture 2 -> 403 Forbidden
        res_lec2 = await client.post(
            f"/api/lectures/{lec2.id}/progress",
            headers=headers,
            json={"watched_seconds": 10.0, "active_screen_time_seconds": 10.0},
        )
        assert res_lec2.status_code == 403
        assert "locked" in res_lec2.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 7. Video Anti-Cheat Heartbeat Clamping
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_video_anti_cheat_delta_clamping():
    async with TestingSessionLocal() as db:
        user = User(
            username="student_cheat",
            password_hash=hash_password("SecretPass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        student = Student(user_id=user.id, full_name="Student Cheat", enrollment_number="EN22EC777")
        course = Course(title="Anti-Cheat Course", course_code="EC777", status=CourseStatus.PUBLISHED)
        db.add_all([student, course])
        await db.commit()
        await db.refresh(student)
        await db.refresh(course)

        enrollment = Enrollment(student_id=student.id, course_id=course.id, status=EnrollmentStatus.ENROLLED)
        module = Module(course_id=course.id, title="Module 1", order_index=1)
        db.add_all([enrollment, module])
        await db.commit()
        await db.refresh(module)

        lec1 = Lecture(
            module_id=module.id,
            title="Lecture 1",
            duration=120.0,
            order_index=1,
            completion_threshold=90.0,
        )
        db.add(lec1)
        await db.commit()
        await db.refresh(lec1)

    token = create_access_token({"sub": str(user.id)})
    headers = {"Authorization": f"Bearer {token}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Initial small progress (10 seconds)
        res1 = await client.post(
            f"/api/lectures/{lec1.id}/progress",
            headers=headers,
            json={"watched_seconds": 10.0, "active_screen_time_seconds": 10.0},
        )
        assert res1.status_code == 200
        data1 = res1.json()
        assert data1["watched_seconds"] == 10.0
        assert data1["completed"] is False

        # Step 2: Immediate jump to 115.0 seconds (cheater trying instant completion)
        res2 = await client.post(
            f"/api/lectures/{lec1.id}/progress",
            headers=headers,
            json={"watched_seconds": 115.0, "active_screen_time_seconds": 115.0},
        )
        assert res2.status_code == 200
        data2 = res2.json()

        # Due to heartbeat delta clamping against wall clock time (~0s elapsed),
        # progress is clamped and NOT allowed to jump immediately to 115s!
        assert data2["watched_seconds"] < 30.0
        assert data2["completed"] is False


# ---------------------------------------------------------------------------
# 8. Revoked Certificate Download Blocking
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_revoked_certificate_download_blocked():
    async with TestingSessionLocal() as db:
        user = User(
            username="student_revoked",
            password_hash=hash_password("SecretPass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        student = Student(user_id=user.id, full_name="Student Revoked", enrollment_number="EN22EC666")
        course = Course(title="Revoked Course", course_code="EC666", status=CourseStatus.PUBLISHED)
        db.add_all([student, course])
        await db.commit()
        await db.refresh(student)
        await db.refresh(course)

        cert = Certificate(
            certificate_number="ECE-2026-REVOKED1",
            student_id=student.id,
            course_id=course.id,
            certificate_file="/certificates/test.pdf",
            is_revoked=True,
        )
        db.add(cert)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Download attempt on revoked certificate -> 403 Forbidden
        res = await client.get("/api/certificates/ECE-2026-REVOKED1/download")
        assert res.status_code == 403
        assert "revoked" in res.json()["detail"].lower()


# ---------------------------------------------------------------------------
# 9. Granular RBAC Permissions
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_granular_rbac_admin_student_deletion():
    async with TestingSessionLocal() as db:
        instructor = User(
            username="dept_instructor",
            password_hash=hash_password("InstrPass@123"),
            role=UserRole.ADMIN,
            is_active=True,
        )
        master = User(
            username="master_super",
            password_hash=hash_password("MasterPass@123"),
            role=UserRole.MASTER_ADMIN,
            is_active=True,
        )
        student_user = User(
            username="student_to_delete",
            password_hash=hash_password("StudentPass@123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add_all([instructor, master, student_user])
        await db.commit()
        await db.refresh(instructor)
        await db.refresh(master)
        await db.refresh(student_user)

        student = Student(user_id=student_user.id, full_name="Student Delete Me", enrollment_number="EN22EC555")
        db.add(student)
        await db.commit()
        await db.refresh(student)

    inst_token = create_access_token({"sub": str(instructor.id)})
    master_token = create_access_token({"sub": str(master.id)})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Instructor / Non-Master-Admin attempts delete -> 403 Forbidden
        res_fail = await client.delete(
            f"/api/admin/students/{student.id}",
            headers={"Authorization": f"Bearer {inst_token}"},
        )
        assert res_fail.status_code == 403

        # Master Admin attempts delete -> succeeds (200)
        res_ok = await client.delete(
            f"/api/admin/students/{student.id}",
            headers={"Authorization": f"Bearer {master_token}"},
        )
        assert res_ok.status_code == 200


# ---------------------------------------------------------------------------
# 10. Security Headers & Uptime Reporting
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_security_headers_and_uptime():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/health")
        assert res.status_code == 200

        # Verify Security Headers
        assert "Content-Security-Policy" in res.headers
        assert "frame-src 'self' https://www.youtube.com" in res.headers["Content-Security-Policy"]
        assert res.headers.get("X-Content-Type-Options") == "nosniff"
        assert res.headers.get("X-Frame-Options") == "SAMEORIGIN"
        assert res.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
        assert res.headers.get("Permissions-Policy") == "camera=(), microphone=(), geolocation=()"

        # Verify Uptime Reporting
        data = res.json()
        assert "backend_uptime" in data
        assert "database_uptime" in data
