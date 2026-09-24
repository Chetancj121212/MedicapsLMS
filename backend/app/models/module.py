"""Module model — chapters within a course."""

from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Module(Base):
    __tablename__ = "modules"

    id = Column(Integer, primary_key=True, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    order_index = Column(Integer, nullable=False, default=0)
    is_required = Column(Boolean, default=True, nullable=False)

    # Relationships
    course = relationship("Course", back_populates="modules")
    lectures = relationship("Lecture", back_populates="module", cascade="all, delete-orphan", order_by="Lecture.order_index")
    quizzes = relationship("Quiz", back_populates="module", cascade="all, delete-orphan")
