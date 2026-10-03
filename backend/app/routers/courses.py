"""Course viewing, curriculum, and enrollment endpoints."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.course import Course, CourseStatus
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.student import Student
from app.models.user import User
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.certificate import Certificate
from app.schemas.schemas import CourseListResponse, CourseResponse
from app.services.auth_service import get_current_user, require_student
from app.services.progress_service import progress_service

router = APIRouter(prefix="/api/courses", tags=["Courses"])


@router.get("", response_model=List[CourseListResponse])
async def list_courses(db: AsyncSession = Depends(get_db)):
    """List all published courses for the public catalog and student browsing."""
    stmt = (
        select(Course)
        .where(Course.status == CourseStatus.PUBLISHED)
        .options(
            selectinload(Course.modules).selectinload(Module.lectures),
            selectinload(Course.modules).selectinload(Module.quizzes),
        )
    )
    res = await db.execute(stmt)
    courses = res.scalars().all()

    result = []
    for c in courses:
        mod_count = len(c.modules)
        lec_count = sum(len([l for l in m.lectures if l.is_published]) for m in c.modules)
        quiz_count = sum(len([q for q in m.quizzes if q.is_published]) for m in c.modules)

        result.append(
            CourseListResponse(
                id=c.id,
                course_code=c.course_code,
                title=c.title,
                short_description=c.short_description,
                instructor_name=c.instructor_name,
                thumbnail=c.thumbnail,
                estimated_duration=c.estimated_duration,
                status=c.status.value if hasattr(c.status, "value") else str(c.status),
                module_count=mod_count,
                lecture_count=lec_count,
                quiz_count=quiz_count,
            )
        )
    return result


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course_detail(course_id: int, db: AsyncSession = Depends(get_db)):
    """Public course overview with syllabus."""
    stmt = (
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.modules).selectinload(Module.lectures),
            selectinload(Course.modules).selectinload(Module.quizzes),
        )
    )
    res = await db.execute(stmt)
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return course


@router.post("/{course_id}/enroll")
async def enroll_course(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enrolls the authenticated student in the specified course."""
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        student = Student(
            user_id=current_user.id,
            full_name=current_user.username.capitalize() + " (Preview)",
            enrollment_number=f"STAFF-{current_user.id:04d}",
            email=f"{current_user.username}@medicaps.ac.in",
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    enrollment = await progress_service.get_or_create_enrollment(db, student.id, course_id)
    return {
        "message": "Enrolled successfully",
        "enrollment_id": enrollment.id,
        "course_id": course_id,
        "status": enrollment.status.value if hasattr(enrollment.status, "value") else str(enrollment.status),
    }


@router.get("/{course_id}/learn")
async def get_learning_path(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns the course curriculum with locked/unlocked/completed states for the student."""
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        student = Student(
            user_id=current_user.id,
            full_name=current_user.username.capitalize() + " (Preview)",
            enrollment_number=f"STAFF-{current_user.id:04d}",
            email=f"{current_user.username}@medicaps.ac.in",
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    try:
        curriculum_status = await progress_service.get_course_curriculum_status(
            db, student.id, course_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Check if certificate exists (already issued by eligibility service)
    cert_stmt = select(Certificate).where(
        and_(Certificate.student_id == student.id, Certificate.course_id == course_id)
    )
    cert_res = await db.execute(cert_stmt)
    cert = cert_res.scalar_one_or_none()

    curriculum_status["certificate"] = {
        "certificate_number": cert.certificate_number,
        "issued_at": cert.issued_at.strftime("%d %B %Y"),
        "is_revoked": cert.is_revoked,
    } if cert else None

    return curriculum_status


@router.get("/{course_id}/eligibility")
async def check_course_eligibility(
    course_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a detailed eligibility breakdown for the authenticated student.
    This is the single source of truth for certificate eligibility.
    """
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    from app.services.eligibility_service import eligibility_service
    eligibility = await eligibility_service.check_eligibility(db, student.id, course_id)

    # Also check if certificate already exists
    cert_stmt = select(Certificate).where(
        and_(Certificate.student_id == student.id, Certificate.course_id == course_id)
    )
    cert_res = await db.execute(cert_stmt)
    cert = cert_res.scalar_one_or_none()

    response = eligibility.to_dict()
    response["certificate"] = {
        "certificate_number": cert.certificate_number,
        "issued_at": cert.issued_at.strftime("%d %B %Y"),
        "is_revoked": cert.is_revoked,
    } if cert else None

    return response
