"""Quiz taking, submission, and attempt history endpoints."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.student import Student
from app.models.user import User
from app.schemas.schemas import QuizSubmission, QuizResultResponse, QuizAttemptResponse
from app.services.auth_service import get_current_user
from app.services.quiz_service import quiz_service

router = APIRouter(prefix="/api/quizzes", tags=["Quizzes"])


@router.get("/{quiz_id}")
async def get_quiz(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    try:
        quiz_data = await quiz_service.get_quiz_for_student(db, quiz_id, student.id)
        return quiz_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{quiz_id}/submit", response_model=QuizResultResponse)
async def submit_quiz(
    quiz_id: int,
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    try:
        result = await quiz_service.evaluate_submission(db, quiz_id, student.id, submission)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{quiz_id}/attempts", response_model=List[QuizAttemptResponse])
async def get_quiz_attempts(
    quiz_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    attempts = await quiz_service.get_quiz_attempts(db, quiz_id, student.id)
    return attempts
