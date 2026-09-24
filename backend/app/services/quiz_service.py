"""Quiz evaluation, attempt management, and hint generation service."""

import random
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.quiz import Quiz
from app.models.question import Question, QuestionType
from app.models.progress import QuizAttempt, QuizAnswer
from app.models.enrollment import Enrollment
from app.models.module import Module
from app.schemas.schemas import QuizSubmission


class QuizService:
    @staticmethod
    async def get_quiz_for_student(
        db: AsyncSession, quiz_id: int, student_id: int
    ) -> Dict[str, Any]:
        stmt = (
            select(Quiz)
            .where(Quiz.id == quiz_id)
            .options(
                selectinload(Quiz.questions).selectinload(Question.options),
                selectinload(Quiz.module)
            )
        )
        res = await db.execute(stmt)
        quiz = res.scalar_one_or_none()
        if not quiz or not quiz.is_published:
            raise ValueError("Quiz not found or not published")

        # Check existing attempts
        stmt_attempts = (
            select(QuizAttempt)
            .where(and_(QuizAttempt.student_id == student_id, QuizAttempt.quiz_id == quiz_id))
            .order_by(QuizAttempt.attempt_number.desc())
        )
        res_attempts = await db.execute(stmt_attempts)
        attempts = res_attempts.scalars().all()

        if quiz.max_attempts and len(attempts) >= quiz.max_attempts:
            # Check if any attempt was passed
            if not any(a.passed for a in attempts):
                raise ValueError(f"Maximum attempts ({quiz.max_attempts}) reached for this quiz.")

        # Prepare questions (WITHOUT is_correct field for security)
        questions_list = list(quiz.questions)
        if quiz.randomize_questions:
            # Deterministic pseudo-random seed per student and attempt number
            attempt_seed = f"{student_id}_{quiz_id}_{len(attempts) + 1}"
            rng = random.Random(attempt_seed)
            rng.shuffle(questions_list)
        else:
            questions_list.sort(key=lambda q: q.order_index)

        safe_questions = []
        for q in questions_list:
            options_list = list(q.options)
            options_list.sort(key=lambda o: o.order_index)
            safe_questions.append({
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                "marks": q.marks,
                "order_index": q.order_index,
                "options": [
                    {
                        "id": opt.id,
                        "option_text": opt.option_text,
                        "order_index": opt.order_index,
                    }
                    for opt in options_list
                ]
            })

        return {
            "id": quiz.id,
            "title": quiz.title,
            "description": quiz.description,
            "passing_percentage": quiz.passing_percentage,
            "max_attempts": quiz.max_attempts,
            "randomize_questions": quiz.randomize_questions,
            "is_final_assessment": quiz.is_final_assessment,
            "questions": safe_questions,
            "total_questions": len(safe_questions),
            "attempt_count": len(attempts),
            "has_passed": any(a.passed for a in attempts),
        }

    @staticmethod
    async def evaluate_submission(
        db: AsyncSession, quiz_id: int, student_id: int, submission: QuizSubmission
    ) -> Dict[str, Any]:
        stmt = (
            select(Quiz)
            .where(Quiz.id == quiz_id)
            .options(
                selectinload(Quiz.questions).selectinload(Question.options),
                selectinload(Quiz.module)
            )
        )
        res = await db.execute(stmt)
        quiz = res.scalar_one_or_none()
        if not quiz:
            raise ValueError("Quiz not found")

        # Determine attempt number
        stmt_count = select(func.count(QuizAttempt.id)).where(
            and_(QuizAttempt.student_id == student_id, QuizAttempt.quiz_id == quiz_id)
        )
        res_count = await db.execute(stmt_count)
        attempt_count = res_count.scalar() or 0

        if quiz.max_attempts and attempt_count >= quiz.max_attempts:
            raise ValueError("Maximum attempts exceeded")

        new_attempt_number = attempt_count + 1

        # Map questions and options
        question_map = {q.id: q for q in quiz.questions}
        submitted_answers_map = {a.question_id: a.selected_option_id for a in submission.answers}

        total_marks = sum(q.marks for q in quiz.questions)
        earned_marks = 0.0
        hints = []
        answer_records = []

        for q in quiz.questions:
            selected_opt_id = submitted_answers_map.get(q.id)
            correct_opt = next((opt for opt in q.options if opt.is_correct), None)

            is_correct = False
            marks_awarded = 0.0

            if correct_opt and selected_opt_id == correct_opt.id:
                is_correct = True
                marks_awarded = q.marks
                earned_marks += q.marks
            else:
                if q.explanation:
                    hints.append(f"Hint: {q.explanation}")
                elif quiz.module:
                    hints.append(f"Hint: Review concepts in '{quiz.module.title}'.")

            answer_records.append({
                "question_id": q.id,
                "selected_option_id": selected_opt_id,
                "is_correct": is_correct,
                "marks_awarded": marks_awarded,
            })

        percentage = round((earned_marks / total_marks * 100) if total_marks > 0 else 100.0, 1)
        passed = percentage >= quiz.passing_percentage

        # Save Attempt
        attempt = QuizAttempt(
            student_id=student_id,
            quiz_id=quiz_id,
            attempt_number=new_attempt_number,
            score=earned_marks,
            total_marks=total_marks,
            percentage=percentage,
            passed=passed,
            started_at=datetime.utcnow(),
            submitted_at=datetime.utcnow(),
        )
        db.add(attempt)
        await db.flush()

        for ans in answer_records:
            q_ans = QuizAnswer(
                attempt_id=attempt.id,
                question_id=ans["question_id"],
                selected_option_id=ans["selected_option_id"],
                is_correct=ans["is_correct"],
                marks_awarded=ans["marks_awarded"],
            )
            db.add(q_ans)

        await db.commit()

        # If passed, recalculate course progress and completion
        from app.services.progress_service import progress_service
        course_id = quiz.course_id or (quiz.module.course_id if quiz.module else None)
        if course_id:
            await progress_service.recalculate_course_progress(db, student_id, course_id)

        # Pick appropriate hint message
        hint_msg = None
        if not passed:
            if hints:
                hint_msg = hints[0]
            elif quiz.module:
                hint_msg = f"Review {quiz.module.title} before attempting again."
            else:
                hint_msg = "Review the course materials before attempting again."

        return {
            "attempt_id": attempt.id,
            "attempt_number": new_attempt_number,
            "score": earned_marks,
            "total_marks": total_marks,
            "percentage": percentage,
            "passed": passed,
            "hint": hint_msg,
        }

    @staticmethod
    async def get_quiz_attempts(
        db: AsyncSession, quiz_id: int, student_id: int
    ) -> List[QuizAttempt]:
        stmt = (
            select(QuizAttempt)
            .where(and_(QuizAttempt.student_id == student_id, QuizAttempt.quiz_id == quiz_id))
            .order_by(QuizAttempt.attempt_number.asc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()


quiz_service = QuizService()
