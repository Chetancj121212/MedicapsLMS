"""Quiz model."""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Quiz(Base):
    __tablename__ = "quizzes"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=True)  # Nullable for final assessment
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)  # For final assessment
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    passing_percentage = Column(Float, default=100.0, nullable=False)
    max_attempts = Column(Integer, nullable=True)  # NULL = unlimited
    randomize_questions = Column(Boolean, default=False, nullable=False)
    is_required = Column(Boolean, default=True, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)
    is_final_assessment = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, default=0, nullable=False)

    # Relationships
    module = relationship("Module", back_populates="quizzes")
    questions = relationship("Question", back_populates="quiz", cascade="all, delete-orphan", order_by="Question.order_index")
    attempts = relationship("QuizAttempt", back_populates="quiz", cascade="all, delete-orphan")
