"""Configuration values used by the local demo seed."""

from dataclasses import dataclass


@dataclass(frozen=True)
class DemoAccount:
    username: str
    password: str


DEMO_ADMIN = DemoAccount(username="admin", password="Admin@123")
DEMO_STUDENT = DemoAccount(username="DEMO001", password="Demo@123")

DEMO_STUDENT_PROFILE = {
    "full_name": "Chetan Kumar",
    "enrollment_number": "DEMO001",
    "email": "chetan.kumar@medicaps.ac.in",
    "department": "Electronics and Communication Engineering",
    "program": "B.Tech (ECE)",
    "semester": 6,
    "academic_year": "2026-2027",
}

DEMO_COURSE = {
    "course_code": "ECE-301",
    "title": "Introduction to Embedded Systems",
    "short_description": "A foundational course on microcontrollers, sensor interfacing, and embedded firmware design.",
    "description": "Designed specifically for ECE undergraduates at Medicaps University. Covers modern microcontroller architectures, hardware interfaces (GPIO, Timers, ADC), and industry-standard communication protocols (UART, SPI, I2C). Includes interactive quizzes and certification upon completion.",
    "instructor_name": "Dr. S. K. Sharma (Professor, ECE)",
    "thumbnail": "/images/embedded_course.jpg",
    "estimated_duration": "8 Weeks (4 Modules)",
}

DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=kqtD5dpn9C8"
LECTURE_COMPLETION_THRESHOLD = 90.0
QUIZ_PASSING_PERCENTAGE = 100.0
DEMO_CERTIFICATE_YEAR = 2026
DEMO_CERTIFICATE_PREFIX = f"ECE-{DEMO_CERTIFICATE_YEAR}-"
DEMO_CERTIFICATE_COMPLETION_DATE = "22 September 2026"
