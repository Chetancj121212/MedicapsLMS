"""Certificate generation, PDF rendering (A4 landscape), QR code generation, and verification."""

import os
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.config import settings
from app.models.certificate import Certificate
from app.models.student import Student
from app.models.course import Course
from app.models.user import User
from app.models.enrollment import Enrollment


class CertificateService:
    @staticmethod
    async def generate_certificate_number(db: AsyncSession, year: Optional[int] = None) -> str:
        current_year = year or datetime.utcnow().year
        prefix = f"ECE-{current_year}-"

        # Find the highest sequence for this year
        stmt = (
            select(Certificate.certificate_number)
            .where(Certificate.certificate_number.like(f"{prefix}%"))
            .order_by(Certificate.certificate_number.desc())
            .limit(1)
        )
        res = await db.execute(stmt)
        last_cert = res.scalar_one_or_none()

        if last_cert:
            try:
                seq_str = last_cert.replace(prefix, "")
                seq = int(seq_str) + 1
            except ValueError:
                seq = 1
        else:
            seq = 1

        return f"{prefix}{seq:06d}"

    @staticmethod
    def generate_qr_code(verification_url: str, output_path: str) -> str:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=6,
            border=2,
        )
        qr.add_data(verification_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#1a237e", back_color="white")
        img.save(output_path)
        return output_path

    @staticmethod
    def generate_pdf(
        certificate_number: str,
        student_name: str,
        enrollment_number: str,
        course_name: str,
        completion_date: str,
        qr_image_path: str,
        output_pdf_path: str,
    ) -> str:
        """Generates an elegant, printable A4 landscape certificate."""
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        width, height = landscape(A4)  # 841.89 x 595.27 points

        c = canvas.Canvas(output_pdf_path, pagesize=landscape(A4))

        # Background & Borders
        # Outer border
        c.setStrokeColor(colors.HexColor("#1a237e"))  # Deep Medicaps Blue
        c.setLineWidth(4)
        c.rect(20, 20, width - 40, height - 40)

        # Inner subtle gold border
        c.setStrokeColor(colors.HexColor("#c5a059"))  # University Gold
        c.setLineWidth(1.5)
        c.rect(28, 28, width - 56, height - 56)

        # Header: University branding
        c.setFillColor(colors.HexColor("#1a237e"))
        c.setFont("Helvetica-Bold", 24)
        c.drawCentredString(width / 2.0, height - 80, "MEDICAPS UNIVERSITY")

        c.setFillColor(colors.HexColor("#424242"))
        c.setFont("Helvetica", 13)
        c.drawCentredString(
            width / 2.0, height - 102, "Department of Electronics Engineering"
        )
        c.setFont("Helvetica-Oblique", 10)
        c.drawCentredString(width / 2.0, height - 118, "Indore, Madhya Pradesh, India")

        # Decorative divider line
        c.setStrokeColor(colors.HexColor("#c5a059"))
        c.setLineWidth(1)
        c.line(width / 2.0 - 180, height - 130, width / 2.0 + 180, height - 130)

        # Title: CERTIFICATE OF COMPLETION
        c.setFillColor(colors.HexColor("#1a237e"))
        c.setFont("Helvetica-Bold", 20)
        c.drawCentredString(width / 2.0, height - 165, "CERTIFICATE OF COMPLETION")

        # Body text
        c.setFillColor(colors.HexColor("#555555"))
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2.0, height - 200, "This is to certify that")

        # Student Name
        c.setFillColor(colors.HexColor("#111827"))
        c.setFont("Helvetica-Bold", 26)
        c.drawCentredString(width / 2.0, height - 238, student_name)

        # Enrollment
        c.setFillColor(colors.HexColor("#666666"))
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2.0, height - 262, f"Enrollment No: {enrollment_number}")

        # Course accomplishment text
        c.setFillColor(colors.HexColor("#555555"))
        c.setFont("Helvetica", 12)
        c.drawCentredString(width / 2.0, height - 296, "has successfully completed the online academic course")

        # Course Name
        c.setFillColor(colors.HexColor("#1a237e"))
        c.setFont("Helvetica-Bold", 19)
        c.drawCentredString(width / 2.0, height - 330, f'"{course_name}"')

        # Department statement
        c.setFillColor(colors.HexColor("#555555"))
        c.setFont("Helvetica", 11)
        c.drawCentredString(
            width / 2.0, height - 355, "offered by the Department of Electronics Engineering"
        )
        c.drawCentredString(width / 2.0, height - 370, "with distinction in all required assessments.")

        # Bottom section: Left (Date & Certificate ID), Center (QR Code), Right (Signatures)
        # Left side
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#333333"))
        c.drawString(60, 110, "Date of Completion:")
        c.setFont("Helvetica", 10)
        c.drawString(60, 95, completion_date)

        c.setFont("Helvetica-Bold", 10)
        c.drawString(60, 75, "Certificate ID:")
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor("#1a237e"))
        c.drawString(60, 60, certificate_number)

        # Center QR code
        if os.path.exists(qr_image_path):
            c.drawImage(qr_image_path, width / 2.0 - 40, 50, width=80, height=80)
            c.setFont("Helvetica", 8)
            c.setFillColor(colors.HexColor("#888888"))
            c.drawCentredString(width / 2.0, 42, "Scan to Verify Authenticity")

        # Right side: Signature & Authorization
        c.setStrokeColor(colors.HexColor("#333333"))
        c.setLineWidth(0.8)
        c.line(width - 240, 95, width - 60, 95)

        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#111827"))
        c.drawCentredString(width - 150, 80, "Authorized Signatory")
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawCentredString(width - 150, 68, "Department of ECE")
        c.drawCentredString(width - 150, 56, "Medicaps University, Indore")

        c.showPage()
        c.save()
        return output_pdf_path

    @staticmethod
    async def issue_certificate_if_eligible(
        db: AsyncSession, student_id: int, course_id: int
    ) -> Optional[Certificate]:
        # Check if already issued
        stmt = select(Certificate).where(
            and_(Certificate.student_id == student_id, Certificate.course_id == course_id)
        )
        res = await db.execute(stmt)
        existing = res.scalar_one_or_none()
        if existing:
            return existing

        # ── FINAL ELIGIBILITY CHECK before issuing ──────────────────────
        # This is the gatekeeper: no certificate is issued unless every
        # mandatory requirement is confirmed satisfied in the database.
        from app.services.eligibility_service import EligibilityService
        eligibility = await EligibilityService.check_eligibility(
            db, student_id, course_id
        )
        if not eligibility.eligible:
            return None

        # Fetch student and course
        res_stud = await db.execute(select(Student).where(Student.id == student_id))
        student = res_stud.scalar_one_or_none()

        res_course = await db.execute(select(Course).where(Course.id == course_id))
        course = res_course.scalar_one_or_none()

        if not student or not course:
            return None

        cert_number = await CertificateService.generate_certificate_number(db)
        issued_date_str = datetime.utcnow().strftime("%d %B %Y")

        cert_dir = os.path.abspath(settings.CERTIFICATE_DIR)
        os.makedirs(cert_dir, exist_ok=True)

        qr_path = os.path.join(cert_dir, f"{cert_number}_qr.png")
        pdf_path = os.path.join(cert_dir, f"{cert_number}.pdf")

        # Verification URL (Section 23 & 40)
        verify_url = f"{settings.FRONTEND_URL}/verify/{cert_number}"

        # Generate QR code
        CertificateService.generate_qr_code(verify_url, qr_path)

        # Generate PDF
        CertificateService.generate_pdf(
            certificate_number=cert_number,
            student_name=student.full_name,
            enrollment_number=student.enrollment_number,
            course_name=course.title,
            completion_date=issued_date_str,
            qr_image_path=qr_path,
            output_pdf_path=pdf_path,
        )

        cert = Certificate(
            certificate_number=cert_number,
            student_id=student_id,
            course_id=course_id,
            issued_at=datetime.utcnow(),
            certificate_file=f"/certificates/{cert_number}.pdf",
            is_revoked=False,
        )
        db.add(cert)
        await db.commit()
        await db.refresh(cert)
        return cert


    @staticmethod
    async def verify_certificate(
        db: AsyncSession, certificate_number: str
    ) -> Dict[str, Any]:
        """Public verification endpoint logic (Section 24, 25, 44)."""
        stmt = (
            select(Certificate)
            .where(Certificate.certificate_number == certificate_number)
            .options(
                selectinload(Certificate.student),
                selectinload(Certificate.course),
            )
        )
        res = await db.execute(stmt)
        cert = res.scalar_one_or_none()

        if not cert:
            return {
                "valid": False,
                "message": "Certificate not found. The certificate ID could not be verified.",
                "certificate": None,
            }

        if cert.is_revoked:
            return {
                "valid": False,
                "message": "This certificate is no longer considered valid. It has been revoked by Medicaps University.",
                "certificate": {
                    "certificateNumber": cert.certificate_number,
                    "studentName": cert.student.full_name if cert.student else "N/A",
                    "courseName": cert.course.title if cert.course else "N/A",
                    "revoked": True,
                    "revokedAt": cert.revoked_at.strftime("%d %B %Y") if cert.revoked_at else None,
                },
            }

        return {
            "valid": True,
            "message": "This certificate is authentic and was issued by Medicaps University.",
            "certificate": {
                "certificateNumber": cert.certificate_number,
                "studentName": cert.student.full_name if cert.student else "N/A",
                "enrollmentNumber": cert.student.enrollment_number if cert.student else "N/A",
                "courseName": cert.course.title if cert.course else "N/A",
                "department": cert.student.department if cert.student else "Electronics and Communication Engineering",
                "institution": "Medicaps University, Indore",
                "issuedAt": cert.issued_at.strftime("%d %B %Y"),
                "revoked": False,
                "downloadUrl": f"{settings.BASE_URL}{cert.certificate_file}" if cert.certificate_file else None,
            },
        }


certificate_service = CertificateService()
