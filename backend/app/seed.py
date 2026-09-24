"""Database seeding script: admin, demo student, sample course, and demo certificate."""

import asyncio
from datetime import datetime
from sqlalchemy import select
from app.database import async_session, init_db
from app.config import settings
from app.models.user import User, UserRole
from app.models.student import Student
from app.models.course import Course, CourseStatus
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.question import Question, QuestionType, QuizOption
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.certificate import Certificate
from app.services.auth_service import hash_password
from app.services.certificate_service import certificate_service
from app.data.demo_config import (
    DEMO_ADMIN,
    DEMO_CERTIFICATE_COMPLETION_DATE,
    DEMO_CERTIFICATE_PREFIX,
    DEMO_CERTIFICATE_YEAR,
    DEMO_COURSE,
    DEMO_STUDENT,
    DEMO_STUDENT_PROFILE,
    DEMO_VIDEO_URL,
    LECTURE_COMPLETION_THRESHOLD,
    QUIZ_PASSING_PERCENTAGE,
)


async def seed():
    print("[*] Initializing database and creating tables...")
    await init_db()

    async with async_session() as db:
        # 1. Admin Account (Section 39)
        admin_res = await db.execute(select(User).where(User.username == DEMO_ADMIN.username))
        admin_user = admin_res.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                username=DEMO_ADMIN.username,
                password_hash=hash_password(DEMO_ADMIN.password),
                role=UserRole.DEPARTMENT_ADMIN,
                is_active=True,
            )
            db.add(admin_user)
            print(f"[+] Admin created: {DEMO_ADMIN.username}")

        # 2. Demo Student Account (Section 39)
        stud_user_res = await db.execute(select(User).where(User.username == DEMO_STUDENT.username))
        stud_user = stud_user_res.scalar_one_or_none()
        if not stud_user:
            stud_user = User(
                username=DEMO_STUDENT.username,
                password_hash=hash_password(DEMO_STUDENT.password),
                role=UserRole.STUDENT,
                is_active=True,
            )
            db.add(stud_user)
            await db.flush()

            demo_student = Student(
                user_id=stud_user.id,
                **DEMO_STUDENT_PROFILE,
            )
            db.add(demo_student)
            await db.flush()
            print(f"[+] Demo Student created: {DEMO_STUDENT.username} ({DEMO_STUDENT_PROFILE['full_name']})")
        else:
            demo_student = (
                await db.execute(select(Student).where(Student.enrollment_number == DEMO_STUDENT_PROFILE["enrollment_number"]))
                ).scalar_one()

        # 3. Sample Course: "Introduction to Embedded Systems" (Section 38)
        course_res = await db.execute(select(Course).where(Course.course_code == DEMO_COURSE["course_code"]))
        course = course_res.scalar_one_or_none()

        # Educational sample video (embeddable YouTube video for LMS testing)
        sample_video = DEMO_VIDEO_URL

        if not course:
            course = Course(
                **DEMO_COURSE,
                status=CourseStatus.PUBLISHED,
                published_at=datetime.utcnow(),
            )
            db.add(course)
            await db.flush()
            print("[+] Course created: Introduction to Embedded Systems (ECE-301)")

            # Module 1 — Introduction
            m1 = Module(
                course_id=course.id,
                title="Module 1 — Introduction to Embedded Systems",
                description="Fundamental concepts, definition, and internal architecture of embedded systems.",
                order_index=1,
            )
            db.add(m1)
            await db.flush()

            l1 = Lecture(
                module_id=m1.id,
                title="What is an Embedded System?",
                description="Overview of embedded computing, constraints, real-time considerations, and system components.",
                video_path=sample_video,
                duration=320.0,
                order_index=1,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            l2 = Lecture(
                module_id=m1.id,
                title="Embedded System Architecture",
                description="Understanding memory maps, CPU cores, buses, and peripheral hardware.",
                video_path=sample_video,
                duration=410.0,
                order_index=2,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            db.add_all([l1, l2])
            await db.flush()

            q1 = Quiz(
                module_id=m1.id,
                course_id=course.id,
                title="Module 1 Assessment: Architecture Basics",
                description="Test your understanding of embedded architecture before proceeding to Module 2.",
                passing_percentage=QUIZ_PASSING_PERCENTAGE,
                randomize_questions=False,
                order_index=1,
                is_published=True,
            )
            db.add(q1)
            await db.flush()

            # Questions for Q1
            ques1 = Question(
                quiz_id=q1.id,
                question_text="Which of the following is a key characteristic of an embedded system?",
                question_type=QuestionType.MCQ,
                marks=1.0,
                order_index=1,
                explanation="Embedded systems are typically dedicated to perform a specific dedicated function with real-time constraints.",
            )
            db.add(ques1)
            await db.flush()

            db.add_all([
                QuizOption(question_id=ques1.id, option_text="General-purpose operating system for desktop use", is_correct=False, order_index=1),
                QuizOption(question_id=ques1.id, option_text="Dedicated function with real-time performance constraints", is_correct=True, order_index=2),
                QuizOption(question_id=ques1.id, option_text="Requires infinite RAM and unlimited cooling", is_correct=False, order_index=3),
                QuizOption(question_id=ques1.id, option_text="Exclusively runs web browsers", is_correct=False, order_index=4),
            ])

            ques2 = Question(
                quiz_id=q1.id,
                question_text="Embedded systems typically operate under tight power and memory constraints.",
                question_type=QuestionType.TRUE_FALSE,
                marks=1.0,
                order_index=2,
                explanation="Most embedded devices run on batteries or limited power supplies with microcontrollers having kilobytes of RAM.",
            )
            db.add(ques2)
            await db.flush()

            db.add_all([
                QuizOption(question_id=ques2.id, option_text="True", is_correct=True, order_index=1),
                QuizOption(question_id=ques2.id, option_text="False", is_correct=False, order_index=2),
            ])

            # Module 2 — Microcontrollers
            m2 = Module(
                course_id=course.id,
                title="Module 2 — Microcontrollers & Peripherals",
                description="Microcontroller basics, register configuration, GPIO control, and hardware timers.",
                order_index=2,
            )
            db.add(m2)
            await db.flush()

            l3 = Lecture(
                module_id=m2.id,
                title="Introduction to Microcontrollers",
                description="Harvard vs Von Neumann architecture, CPU registers, and flash memory.",
                video_path=sample_video,
                duration=380.0,
                order_index=1,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            l4 = Lecture(
                module_id=m2.id,
                title="GPIO and Timers",
                description="Digital inputs/outputs, pull-up resistors, timer prescalers, and PWM generation.",
                video_path=sample_video,
                duration=450.0,
                order_index=2,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            db.add_all([l3, l4])
            await db.flush()

            q2 = Quiz(
                module_id=m2.id,
                course_id=course.id,
                title="Module 2 Assessment: Microcontrollers",
                description="Evaluate your knowledge on GPIO registers and timer operations.",
                passing_percentage=QUIZ_PASSING_PERCENTAGE,
                order_index=1,
                is_published=True,
            )
            db.add(q2)
            await db.flush()

            ques3 = Question(
                quiz_id=q2.id,
                question_text="What does GPIO stand for in microcontroller systems?",
                question_type=QuestionType.MCQ,
                marks=1.0,
                order_index=1,
                explanation="GPIO stands for General Purpose Input/Output pin.",
            )
            db.add(ques3)
            await db.flush()
            db.add_all([
                QuizOption(question_id=ques3.id, option_text="General Purpose Input/Output", is_correct=True, order_index=1),
                QuizOption(question_id=ques3.id, option_text="Global Packet Interface Operation", is_correct=False, order_index=2),
                QuizOption(question_id=ques3.id, option_text="Gate Pulse Internal Oscillator", is_correct=False, order_index=3),
            ])

            # Module 3 — Sensors & Actuators
            m3 = Module(
                course_id=course.id,
                title="Module 3 — Sensors & Analog Interfacing",
                description="Interfacing analog and digital sensors, ADC sampling, and signal conditioning.",
                order_index=3,
            )
            db.add(m3)
            await db.flush()

            l5 = Lecture(
                module_id=m3.id,
                title="Sensors and Actuators",
                description="Transducers, temperature, accelerometer, and motor driving basics.",
                video_path=sample_video,
                duration=360.0,
                order_index=1,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            l6 = Lecture(
                module_id=m3.id,
                title="ADC and Sensor Interfaces",
                description="Analog-to-digital conversion, resolution, sampling frequency, and reference voltages.",
                video_path=sample_video,
                duration=420.0,
                order_index=2,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            db.add_all([l5, l6])
            await db.flush()

            q3 = Quiz(
                module_id=m3.id,
                course_id=course.id,
                title="Module 3 Assessment: Sensors & ADC",
                description="Test knowledge on ADC resolution and sampling theorem.",
                passing_percentage=QUIZ_PASSING_PERCENTAGE,
                order_index=1,
                is_published=True,
            )
            db.add(q3)
            await db.flush()

            ques4 = Question(
                quiz_id=q3.id,
                question_text="A 10-bit ADC provides how many discrete digital quantization levels?",
                question_type=QuestionType.MCQ,
                marks=1.0,
                order_index=1,
                explanation="2^10 = 1024 discrete voltage steps (from 0 to 1023).",
            )
            db.add(ques4)
            await db.flush()
            db.add_all([
                QuizOption(question_id=ques4.id, option_text="256", is_correct=False, order_index=1),
                QuizOption(question_id=ques4.id, option_text="512", is_correct=False, order_index=2),
                QuizOption(question_id=ques4.id, option_text="1024", is_correct=True, order_index=3),
                QuizOption(question_id=ques4.id, option_text="2048", is_correct=False, order_index=4),
            ])

            # Module 4 — Communication Protocols & Final Assessment
            m4 = Module(
                course_id=course.id,
                title="Module 4 — Embedded Communication Protocols",
                description="Serial protocols: UART, SPI, and I2C.",
                order_index=4,
            )
            db.add(m4)
            await db.flush()

            l7 = Lecture(
                module_id=m4.id,
                title="UART Protocol",
                description="Asynchronous serial transmission, baud rate, start/stop bits, and parity.",
                video_path=sample_video,
                duration=340.0,
                order_index=1,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            l8 = Lecture(
                module_id=m4.id,
                title="SPI (Serial Peripheral Interface)",
                description="Synchronous full-duplex communication with MOSI, MISO, SCLK, and CS lines.",
                video_path=sample_video,
                duration=390.0,
                order_index=2,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            l9 = Lecture(
                module_id=m4.id,
                title="I2C (Inter-Integrated Circuit)",
                description="Two-wire protocol (SDA, SCL), multi-master addressing, and acknowledgments.",
                video_path=sample_video,
                duration=415.0,
                order_index=3,
                completion_threshold=LECTURE_COMPLETION_THRESHOLD,
            )
            db.add_all([l7, l8, l9])
            await db.flush()

            # Final Assessment for Course Completion (Section 19, 38)
            final_quiz = Quiz(
                module_id=m4.id,
                course_id=course.id,
                title="Final Comprehensive Assessment",
                description="Comprehensive test covering Embedded Systems, Peripherals, and Protocols. Requires 100% to qualify for Certificate.",
                passing_percentage=QUIZ_PASSING_PERCENTAGE,
                is_final_assessment=True,
                order_index=4,
                is_published=True,
            )
            db.add(final_quiz)
            await db.flush()

            fq1 = Question(
                quiz_id=final_quiz.id,
                question_text="Which protocol is commonly used for short-distance serial communication without a shared clock wire?",
                question_type=QuestionType.MCQ,
                marks=1.0,
                order_index=1,
                explanation="UART (Universal Asynchronous Receiver-Transmitter) uses asynchronous data lines with agreed baud rate.",
            )
            db.add(fq1)
            await db.flush()
            db.add_all([
                QuizOption(question_id=fq1.id, option_text="UART", is_correct=True, order_index=1),
                QuizOption(question_id=fq1.id, option_text="HTTP", is_correct=False, order_index=2),
                QuizOption(question_id=fq1.id, option_text="FTP", is_correct=False, order_index=3),
                QuizOption(question_id=fq1.id, option_text="SMTP", is_correct=False, order_index=4),
            ])

            fq2 = Question(
                quiz_id=final_quiz.id,
                question_text="UART is a serial communication protocol.",
                question_type=QuestionType.TRUE_FALSE,
                marks=1.0,
                order_index=2,
                explanation="UART transmits bits sequentially in a serial bitstream.",
            )
            db.add(fq2)
            await db.flush()
            db.add_all([
                QuizOption(question_id=fq2.id, option_text="True", is_correct=True, order_index=1),
                QuizOption(question_id=fq2.id, option_text="False", is_correct=False, order_index=2),
            ])

            # Auto-enroll demo student
            demo_enr = Enrollment(
                student_id=demo_student.id,
                course_id=course.id,
                status=EnrollmentStatus.IN_PROGRESS,
                progress_percentage=0.0,
            )
            db.add(demo_enr)

            # 4. Seed Demo Certificate for Verification Testing (Section 40)
            existing_certificate = (
                await db.execute(
                    select(Certificate).where(
                        Certificate.student_id == demo_student.id,
                        Certificate.course_id == course.id,
                    )
                )
            ).scalar_one_or_none()

            if not existing_certificate:
                existing_numbers = (
                    await db.execute(
                        select(Certificate.certificate_number).where(Certificate.certificate_number.like(f"{DEMO_CERTIFICATE_PREFIX}%"))
                    )
                ).scalars().all()

                next_seq = 1
                for cert_number in existing_numbers:
                    try:
                        suffix = int(str(cert_number).split("-")[-1])
                        if suffix >= next_seq:
                            next_seq = suffix + 1
                    except (TypeError, ValueError):
                        continue

                cert_number = f"{DEMO_CERTIFICATE_PREFIX}{next_seq:06d}"
                sample_cert = Certificate(
                    certificate_number=cert_number,
                    student_id=demo_student.id,
                    course_id=course.id,
                    issued_at=datetime.utcnow(),
                    is_revoked=False,
                )
                db.add(sample_cert)
                await db.flush()

                try:
                    cert_dir = settings.CERTIFICATE_DIR
                    qr_path = f"{cert_dir}/{cert_number}_qr.png"
                    pdf_path = f"{cert_dir}/{cert_number}.pdf"
                    certificate_service.generate_qr_code(f"{settings.FRONTEND_URL}/verify/{cert_number}", qr_path)
                    certificate_service.generate_pdf(
                        certificate_number=cert_number,
                        student_name=DEMO_STUDENT_PROFILE["full_name"],
                        enrollment_number=DEMO_STUDENT_PROFILE["enrollment_number"],
                        course_name=DEMO_COURSE["title"],
                        completion_date=DEMO_CERTIFICATE_COMPLETION_DATE,
                        qr_image_path=qr_path,
                        output_pdf_path=pdf_path,
                    )
                    print(f"[+] Demo Certificate {cert_number} PDF & QR generated!")
                except Exception as e:
                    print(f"[!] Warning generating demo cert PDF: {e}")

            await db.commit()

    print("[***] Seed data completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
