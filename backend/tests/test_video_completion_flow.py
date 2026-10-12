import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool
from datetime import datetime

from app.database import Base, get_db
from app.main import app
from app.models.user import User, UserRole
from app.models.student import Student
from app.models.course import Course, CourseStatus
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.progress import LectureProgress
from app.models.certificate import Certificate
from app.services.auth_service import hash_password, create_access_token
from app.services.progress_service import progress_service
from app.services.certificate_service import certificate_service
from app.services.eligibility_service import eligibility_service

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


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_seeking_does_not_mark_lecture_completed():
    """Seeking near the end with little watched time must NOT mark lecture completed."""
    async with TestingSessionLocal() as db:
        user = User(
            username="student1",
            password_hash=hash_password("Pass123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        student = Student(
            user_id=user.id,
            full_name="Student One",
            enrollment_number="STU-001",
            email="s1@medicaps.ac.in",
        )
        db.add(student)

        course = Course(
            course_code="ECE-101",
            title="Digital Electronics",
            status=CourseStatus.PUBLISHED,
        )
        db.add(course)
        await db.flush()

        mod = Module(course_id=course.id, title="Module 1", order_index=1)
        db.add(mod)
        await db.flush()

        lecture = Lecture(
            module_id=mod.id,
            title="Lecture 1",
            duration=300.0,
            completion_threshold=90.0,
            is_published=True,
            is_required=True,
        )
        db.add(lecture)
        await db.commit()

        # Simulate user scrubbing to 280s out of 300s, but only having watched 5s
        progress = await progress_service.update_lecture_progress(
            db=db,
            student_id=student.id,
            lecture_id=lecture.id,
            watched_seconds=5.0,
            completion_percentage=93.3,  # Fake client percentage based on position
            last_position_seconds=280.0,
            segments=[[0, 5.0]],
            duration=300.0,
            video_play_time_seconds=5.0,
            active_screen_time_seconds=5.0,
        )

        assert progress.completed is False
        assert progress.completion_percentage < 90.0

        # Eligibility check must also report incomplete
        is_done = eligibility_service._is_lecture_completed(lecture, progress)
        assert is_done is False


@pytest.mark.asyncio
async def test_genuine_watch_marks_lecture_completed():
    """Watching >= 90% with sufficient active screen time marks lecture completed."""
    async with TestingSessionLocal() as db:
        user = User(
            username="student2",
            password_hash=hash_password("Pass123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        student = Student(
            user_id=user.id,
            full_name="Student Two",
            enrollment_number="STU-002",
            email="s2@medicaps.ac.in",
        )
        db.add(student)

        course = Course(
            course_code="ECE-102",
            title="VLSI Design",
            status=CourseStatus.PUBLISHED,
        )
        db.add(course)
        await db.flush()

        mod = Module(course_id=course.id, title="Module 1", order_index=1)
        db.add(mod)
        await db.flush()

        lecture = Lecture(
            module_id=mod.id,
            title="Lecture 1",
            duration=100.0,
            completion_threshold=90.0,
            is_published=True,
            is_required=True,
        )
        db.add(lecture)
        await db.commit()

        # User watched segments covering 92 seconds of a 100-second video
        progress = await progress_service.update_lecture_progress(
            db=db,
            student_id=student.id,
            lecture_id=lecture.id,
            watched_seconds=92.0,
            completion_percentage=92.0,
            last_position_seconds=92.0,
            segments=[[0, 50.0], [45.0, 92.0]],
            duration=100.0,
            video_play_time_seconds=92.0,
            active_screen_time_seconds=80.0,
        )

        assert progress.completed is True
        assert progress.completion_percentage == 100.0


@pytest.mark.asyncio
async def test_certificates_api_and_idempotent_creation():
    """Completing course issues exactly 1 certificate and appears in /api/certificates/my."""
    async with TestingSessionLocal() as db:
        user = User(
            username="student3",
            password_hash=hash_password("Pass123"),
            role=UserRole.STUDENT,
            is_active=True,
        )
        db.add(user)
        await db.flush()

        student = Student(
            user_id=user.id,
            full_name="Student Three",
            enrollment_number="STU-003",
            email="s3@medicaps.ac.in",
        )
        db.add(student)

        course = Course(
            course_code="ECE-103",
            title="Signals and Systems",
            status=CourseStatus.PUBLISHED,
        )
        db.add(course)
        await db.flush()

        mod = Module(course_id=course.id, title="Module 1", order_index=1)
        db.add(mod)
        await db.flush()

        lecture = Lecture(
            module_id=mod.id,
            title="Lecture 1",
            duration=100.0,
            completion_threshold=90.0,
            is_published=True,
            is_required=True,
        )
        db.add(lecture)
        await db.commit()

        # Complete the lecture
        await progress_service.update_lecture_progress(
            db=db,
            student_id=student.id,
            lecture_id=lecture.id,
            watched_seconds=95.0,
            completion_percentage=95.0,
            last_position_seconds=95.0,
            segments=[[0, 95.0]],
            duration=100.0,
            video_play_time_seconds=95.0,
            active_screen_time_seconds=85.0,
        )

        # Check eligibility and complete course
        elig = await eligibility_service.complete_course_if_eligible(
            db, student.id, course.id
        )
        assert elig.eligible is True

        # Test idempotency of issue_certificate_if_eligible
        cert1 = await certificate_service.issue_certificate_if_eligible(
            db, student.id, course.id
        )
        assert cert1 is not None

        cert2 = await certificate_service.issue_certificate_if_eligible(
            db, student.id, course.id
        )
        assert cert2.id == cert1.id
        assert cert2.certificate_number == cert1.certificate_number

    # Now verify HTTP endpoints
    token = create_access_token({"sub": str(user.id), "role": "STUDENT"})
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Test /api/certificates/my
        res = await client.get(
            "/api/certificates/my",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["course_id"] == course.id
        assert data[0]["certificate_number"] == cert1.certificate_number

        # Test /api/certificates/my-certificates
        res_alias = await client.get(
            "/api/certificates/my-certificates",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_alias.status_code == 200
        assert len(res_alias.json()) == 1

        # Test /api/certificates/student/my-certificates
        res_alias2 = await client.get(
            "/api/certificates/student/my-certificates",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_alias2.status_code == 200
        assert len(res_alias2.json()) == 1
