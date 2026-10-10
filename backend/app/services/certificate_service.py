"""Certificate generation, PDF rendering (A4 landscape), QR code generation, and verification."""

import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any
from xml.sax.saxutils import escape
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

import qrcode
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont, TTFError
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
        """Generate an A4 landscape certificate using the existing certificate data."""
        os.makedirs(os.path.dirname(output_pdf_path), exist_ok=True)
        width, height = landscape(A4)  # 841.89 x 595.27 points

        c = canvas.Canvas(output_pdf_path, pagesize=landscape(A4))

        navy = colors.HexColor("#1B3A6B")
        crimson = colors.HexColor("#9A1E33")
        pale_blue = colors.HexColor("#E9EFF7")
        pale_crimson = colors.HexColor("#F5E8EC")
        light_grey = colors.HexColor("#F7F8FA")
        muted_navy = colors.HexColor("#60708A")
        border_blue = colors.HexColor("#DCE4F0")

        def register_font_pair(
            regular_name: str,
            bold_name: str,
            candidates: list[tuple[Path, Path]],
        ) -> tuple[str, str]:
            for regular_path, bold_path in candidates:
                if regular_path.exists() and bold_path.exists():
                    try:
                        pdfmetrics.registerFont(TTFont(regular_name, str(regular_path)))
                        pdfmetrics.registerFont(TTFont(bold_name, str(bold_path)))
                        return regular_name, bold_name
                    except (OSError, TTFError):
                        continue
            return "Times-Roman", "Times-Bold"

        serif, serif_bold = register_font_pair(
            "CertificateSerif",
            "CertificateSerifBold",
            [
                (Path(r"C:\Windows\Fonts\georgia.ttf"), Path(r"C:\Windows\Fonts\georgiab.ttf")),
                (Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf")),
            ],
        )
        sans, sans_bold = register_font_pair(
            "CertificateSans",
            "CertificateSansBold",
            [
                (Path(r"C:\Windows\Fonts\arial.ttf"), Path(r"C:\Windows\Fonts\arialbd.ttf")),
                (Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")),
            ],
        )

        def triangle(points: list[tuple[float, float]], fill: colors.Color, alpha: float) -> None:
            c.saveState()
            c.setFillColor(fill)
            c.setFillAlpha(alpha)
            path = c.beginPath()
            path.moveTo(*points[0])
            for point in points[1:]:
                path.lineTo(*point)
            path.close()
            c.drawPath(path, fill=1, stroke=0)
            c.restoreState()

        def centered_paragraph(text: str, y: float, font: str, size: float, color: colors.Color, max_width: float, leading: float) -> None:
            style = ParagraphStyle(
                "certificate_centered",
                fontName=font,
                fontSize=size,
                leading=leading,
                textColor=color,
                alignment=1,
                spaceAfter=0,
            )
            paragraph = Paragraph(escape(text), style)
            paragraph.wrapOn(c, max_width, 80)
            paragraph.drawOn(c, width / 2.0 - max_width / 2.0, y)

        # Restrained geometry stays outside the content-safe area.
        triangle([(24, height - 24), (138, height - 24), (24, height - 132)], navy, 0.1)
        triangle([(24, height - 24), (92, height - 24), (24, height - 88)], crimson, 0.1)
        triangle([(width - 24, 24), (width - 150, 24), (width - 24, 132)], navy, 0.1)
        triangle([(width - 24, 24), (width - 92, 24), (width - 24, 88)], crimson, 0.1)
        triangle([(width - 24, height / 2 + 45), (width - 48, height / 2 + 5), (width - 24, height / 2 - 35)], pale_blue, 0.7)

        # Fine double-line print border.
        c.setStrokeColor(crimson)
        c.setLineWidth(1.1)
        c.rect(24, 24, width - 48, height - 48)
        c.setStrokeColor(border_blue)
        c.setLineWidth(0.65)
        c.rect(31, 31, width - 62, height - 62)

        # Compact official branding block.
        logo_path = Path(__file__).resolve().parents[3] / "frontend" / "public" / "medicaps-logo.png"
        if logo_path.exists():
            c.drawImage(str(logo_path), 66, height - 93, width=122, height=37, preserveAspectRatio=True, mask="auto")
        c.setFillColor(navy)
        c.setFont(sans_bold, 22)
        c.drawCentredString(width / 2.0, height - 65, "MEDICAPS UNIVERSITY")
        c.setFont(sans, 11)
        c.drawCentredString(width / 2.0, height - 82, "Department of Electronics Engineering")
        c.setFillColor(muted_navy)
        c.setFont(sans, 9)
        c.drawCentredString(width / 2.0, height - 96, "Indore, Madhya Pradesh, India")

        # Heading, divider, and geometric center detail.
        c.setFillColor(crimson)
        c.setFont(serif_bold, 21)
        c.drawCentredString(width / 2.0, height - 151, "CERTIFICATE OF COMPLETION")
        c.setStrokeColor(crimson)
        c.setLineWidth(0.9)
        c.line(width / 2.0 - 190, height - 166, width / 2.0 - 10, height - 166)
        c.line(width / 2.0 + 10, height - 166, width / 2.0 + 190, height - 166)
        triangle([(width / 2.0, height - 158), (width / 2.0 + 7, height - 166), (width / 2.0, height - 174), (width / 2.0 - 7, height - 166)], navy, 1)

        c.setFillColor(muted_navy)
        c.setFont(sans, 11)
        c.drawCentredString(width / 2.0, height - 201, "This is to certify that")
        centered_paragraph(student_name, height - 246, serif_bold, 25, navy, 600, 30)
        c.setFillColor(muted_navy)
        c.setFont(sans, 10)
        c.drawCentredString(width / 2.0, height - 267, f"Enrollment No: {enrollment_number}")
        c.setFont(sans, 11)
        c.drawCentredString(width / 2.0, height - 300, "has successfully completed the online academic course")
        centered_paragraph(f'"{course_name}"', height - 345, serif_bold, 18, crimson, 560, 22)
        c.setFillColor(muted_navy)
        c.setFont(sans, 10)
        c.drawCentredString(width / 2.0, height - 367, "offered by the Department of Electronics Engineering")
        c.drawCentredString(width / 2.0, height - 382, "with distinction in all required assessments.")

        # Balanced three-column footer.
        c.setStrokeColor(border_blue)
        c.setLineWidth(0.6)
        c.line(270, 52, 270, 139)
        c.line(width - 270, 52, width - 270, 139)

        c.setFillColor(navy)
        c.setFont(sans_bold, 9)
        c.drawString(72, 119, "DATE OF COMPLETION")
        c.setFillColor(muted_navy)
        c.setFont(sans, 10)
        c.drawString(72, 103, completion_date)
        c.setFillColor(navy)
        c.setFont(sans_bold, 9)
        c.drawString(72, 78, "CERTIFICATE ID")
        c.setFillColor(crimson)
        c.setFont(sans, 10)
        c.drawString(72, 62, certificate_number)

        if os.path.exists(qr_image_path):
            c.drawImage(qr_image_path, width / 2.0 - 38, 62, width=76, height=76, preserveAspectRatio=True, mask="auto")
        c.setFillColor(muted_navy)
        c.setFont(sans, 8)
        c.drawCentredString(width / 2.0, 51, "Scan to Verify Authenticity")

        signature_x = width - 150
        c.setStrokeColor(crimson)
        c.setLineWidth(0.8)
        c.line(signature_x - 92, 99, signature_x + 92, 99)
        c.setFillColor(navy)
        c.setFont(sans_bold, 10)
        c.drawCentredString(signature_x, 83, "Authorized Signatory")
        c.setFillColor(muted_navy)
        c.setFont(sans, 9)
        c.drawCentredString(signature_x, 68, "Department of ECE")
        c.drawCentredString(signature_x, 55, "Medicaps University, Indore")

        c.showPage()
        c.save()
        return output_pdf_path

    @staticmethod
    async def issue_certificate_if_eligible(
        db: AsyncSession, student_id: int, course_id: int
    ) -> Optional[Certificate]:
        # Check if already issued
        stmt = select(Certificate).where(
            and_(
                Certificate.student_id == student_id,
                Certificate.course_id == course_id,
                Certificate.is_revoked == False,
            )
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
                "downloadUrl": f"{settings.BASE_URL.rstrip('/')}/api/certificates/{cert.certificate_number}/download" if cert.certificate_number else None,
            },
        }


certificate_service = CertificateService()
