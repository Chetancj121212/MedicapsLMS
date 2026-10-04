"""Student dashboard and profile management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.user import User
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.certificate import Certificate
from app.models.course import Course
from app.schemas.schemas import StudentResponse, StudentUpdate, StudentDashboardResponse
from app.services.auth_service import require_student

router = APIRouter(prefix="/api/student", tags=["Student"])


@router.get("/dashboard")
async def get_student_dashboard(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    # Fetch enrollments with course details
    stmt_enr = (
        select(Enrollment)
        .where(Enrollment.student_id == student.id)
        .options(selectinload(Enrollment.course))
        .order_by(Enrollment.enrolled_at.desc())
    )
    res_enr = await db.execute(stmt_enr)
    enrollments = res_enr.scalars().all()

    enrolled_count = len(enrollments)
    in_progress_count = sum(1 for e in enrollments if e.status == EnrollmentStatus.IN_PROGRESS or (e.status == EnrollmentStatus.ENROLLED and e.progress_percentage > 0))
    completed_count = sum(1 for e in enrollments if e.status == EnrollmentStatus.COMPLETED)

    # Certificates count
    stmt_cert = select(func.count(Certificate.id)).where(
        and_(Certificate.student_id == student.id, Certificate.is_revoked == False)
    )
    res_cert = await db.execute(stmt_cert)
    certificates_count = res_cert.scalar() or 0

    return {
        "student": {
            "id": student.id,
            "user_id": student.user_id,
            "full_name": student.full_name,
            "enrollment_number": student.enrollment_number,
            "email": student.email,
            "department": student.department,
            "program": student.program,
            "semester": student.semester,
            "academic_year": student.academic_year,
            "created_at": student.created_at,
        },
        "stats": {
            "enrolled_courses": enrolled_count,
            "in_progress_courses": in_progress_count,
            "completed_courses": completed_count,
            "certificates_earned": certificates_count,
        },
        "enrollments": [
            {
                "id": e.id,
                "course_id": e.course_id,
                "course_title": e.course.title if e.course else "Unknown Course",
                "course_code": e.course.course_code if e.course else "",
                "instructor_name": e.course.instructor_name if e.course else "",
                "status": e.status.value if hasattr(e.status, "value") else str(e.status),
                "progress_percentage": e.progress_percentage,
                "enrolled_at": e.enrolled_at,
                "completed_at": e.completed_at,
            }
            for e in enrollments
        ],
    }


@router.get("/profile")
async def get_profile(
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Student).where(Student.user_id == current_user.id)
    res = await db.execute(stmt)
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    return student


@router.put("/profile")
async def update_profile(
    data: StudentUpdate,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Student).where(Student.user_id == current_user.id)
    res = await db.execute(stmt)
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")

    if data.full_name is not None:
        student.full_name = data.full_name
    if data.email is not None:
        student.email = data.email
    if data.semester is not None:
        student.semester = data.semester
    if data.academic_year is not None:
        student.academic_year = data.academic_year

    await db.commit()
    await db.refresh(student)
    return student
