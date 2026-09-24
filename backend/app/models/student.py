"""Student model — extended student profile linked to User."""

from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    full_name = Column(String(200), nullable=False)
    enrollment_number = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(200), nullable=True)
    department = Column(String(200), default="Electronics and Communication Engineering")
    program = Column(String(200), nullable=True)
    semester = Column(Integer, nullable=True)
    academic_year = Column(String(20), nullable=True)
    profile_photo = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="student")
    enrollments = relationship("Enrollment", back_populates="student", cascade="all, delete-orphan")
    lecture_progress = relationship("LectureProgress", back_populates="student", cascade="all, delete-orphan")
    quiz_attempts = relationship("QuizAttempt", back_populates="student", cascade="all, delete-orphan")
    certificates = relationship("Certificate", back_populates="student", cascade="all, delete-orphan")
