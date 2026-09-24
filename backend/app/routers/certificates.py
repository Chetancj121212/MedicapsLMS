"""Certificate verification and student certificate download endpoints."""

import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models.certificate import Certificate
from app.models.student import Student
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.certificate_service import certificate_service

router = APIRouter(prefix="/api/certificates", tags=["Certificates"])


@router.get("/verify/{certificate_number}")
async def verify_certificate(certificate_number: str, db: AsyncSession = Depends(get_db)):
    """Public verification endpoint (Section 24, 25, 44). Anyone can scan QR and verify."""
    result = await certificate_service.verify_certificate(db, certificate_number)
    return result


@router.get("/my-certificates")
async def get_my_certificates(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Returns all certificates earned by the currently logged-in student."""
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile not found")

    stmt = (
        select(Certificate)
        .where(Certificate.student_id == student.id)
        .options(selectinload(Certificate.course))
        .order_by(Certificate.issued_at.desc())
    )
    res = await db.execute(stmt)
    certs = res.scalars().all()

    return [
        {
            "id": c.id,
            "certificate_number": c.certificate_number,
            "course_id": c.course_id,
            "course_title": c.course.title if c.course else "ECE Course",
            "issued_at": c.issued_at.strftime("%d %B %Y"),
            "is_revoked": c.is_revoked,
            "download_url": f"{settings.BASE_URL}{c.certificate_file}" if c.certificate_file else None,
        }
        for c in certs
    ]


@router.get("/{certificate_number}/download")
async def download_certificate(certificate_number: str, db: AsyncSession = Depends(get_db)):
    """Serves the generated PDF certificate."""
    stmt = (
        select(Certificate)
        .where(Certificate.certificate_number == certificate_number)
        .options(selectinload(Certificate.student), selectinload(Certificate.course))
    )
    res = await db.execute(stmt)
    cert = res.scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    cert_dir = os.path.abspath(settings.CERTIFICATE_DIR)
    os.makedirs(cert_dir, exist_ok=True)
    pdf_path = os.path.join(cert_dir, f"{certificate_number}.pdf")

    if not os.path.exists(pdf_path):
        qr_path = os.path.join(cert_dir, f"{certificate_number}_qr.png")
        verify_url = f"{settings.FRONTEND_URL}/verify/{certificate_number}"
        certificate_service.generate_qr_code(verify_url, qr_path)
        certificate_service.generate_pdf(
            certificate_number=certificate_number,
            student_name=cert.student.full_name if cert.student else "Student",
            enrollment_number=cert.student.enrollment_number if cert.student else "N/A",
            course_name=cert.course.title if cert.course else "Course",
            completion_date=cert.issued_at.strftime("%d %B %Y") if cert.issued_at else "2026",
            qr_image_path=qr_path,
            output_pdf_path=pdf_path,
        )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"Medicaps_Certificate_{certificate_number}.pdf",
    )
