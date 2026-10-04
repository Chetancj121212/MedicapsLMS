"""Models package with all models imported for complete SQLAlchemy mapper registry."""

from app.models.user import User, UserRole
from app.models.student import Student
from app.models.course import Course, CourseStatus
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.question import Question, QuestionType, QuizOption
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.progress import LectureProgress, QuizAttempt
from app.models.certificate import Certificate
from app.models.audit import AuditLog
from app.models.revoked_token import RevokedToken

__all__ = [
    "User",
    "UserRole",
    "AuditLog",
    "RevokedToken",
    "Student",
    "Course",
    "CourseStatus",
    "Module",
    "Lecture",
    "Quiz",
    "Question",
    "QuestionType",
    "QuizOption",
    "Enrollment",
    "EnrollmentStatus",
    "LectureProgress",
    "QuizAttempt",
    "Certificate",
]
