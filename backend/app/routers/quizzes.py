"""Quiz taking, submission, and attempt history endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.student import Student
from app.models.user import User
from app.models.quiz import Quiz
from app.models.enrollment import Enrollment
from app.schemas.schemas import QuizSubmission, QuizResultResponse, QuizAttemptResponse
from app.services.auth_service import require_student
from app.services.quiz_service import quiz_service
from app.services.progress_service import progress_service
from app.limiter import limiter

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])


async def verify_quiz_access(db: AsyncSession, student_id: int, quiz_id: int) -> int:
    """Verify quiz exists, student is actively enrolled, and quiz is unlocked."""
    stmt = select(Quiz).options(selectinload(Quiz.module)).where(Quiz.id == quiz_id)
    res = await db.execute(stmt)
    quiz = res.scalar_one_or_none()
    if not quiz or not quiz.is_published:
        raise HTTPException(status_code=404, detail="Quiz not found")

    course_id = quiz.course_id or (quiz.module.course_id if quiz.module else None)
    if not course_id:
        raise HTTPException(status_code=400, detail="Quiz is not linked to any course")

    # 1. Verify enrollment (IDOR prevention)
    enr_stmt = select(Enrollment).where(
        and_(Enrollment.student_id == student_id, Enrollment.course_id == course_id)
    )
    enr_res = await db.execute(enr_stmt)
    if not enr_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not enrolled in the course for this quiz.",
        )

    # 2. Verify sequential unlocking
    is_locked = await progress_service.is_quiz_locked(db, student_id, quiz_id)
    if is_locked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This quiz is locked. Complete all required prerequisite lectures first.",
        )

    return course_id


@router.get("/{quiz_id}")
async def get_quiz(
    quiz_id: int,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    await verify_quiz_access(db, student.id, quiz_id)

    try:
        quiz_data = await quiz_service.get_quiz_for_student(db, quiz_id, student.id)
        return quiz_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{quiz_id}/submit", response_model=QuizResultResponse)
@limiter.limit("10/minute")
async def submit_quiz(
    request: Request,
    quiz_id: int,
    submission: QuizSubmission,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    await verify_quiz_access(db, student.id, quiz_id)

    try:
        result = await quiz_service.evaluate_submission(db, quiz_id, student.id, submission)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{quiz_id}/attempts", response_model=List[QuizAttemptResponse])
async def get_quiz_attempts(
    quiz_id: int,
    current_user: User = Depends(require_student),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    stmt = select(Quiz).options(selectinload(Quiz.module)).where(Quiz.id == quiz_id)
    res = await db.execute(stmt)
    quiz = res.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    course_id = quiz.course_id or (quiz.module.course_id if quiz.module else None)
    if course_id:
        enr_stmt = select(Enrollment).where(
            and_(Enrollment.student_id == student.id, Enrollment.course_id == course_id)
        )
        enr_res = await db.execute(enr_stmt)
        if not enr_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not enrolled in the course for this quiz.",
            )

    attempts = await quiz_service.get_quiz_attempts(db, quiz_id, student.id)
    return attempts
