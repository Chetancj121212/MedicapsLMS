"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Progress } from "@/components/ui/Progress";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ArrowLeft,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  Award,
  BookOpen,
} from "lucide-react";

interface StudentEnrollment {
  id: number;
  course_id: number;
  course_title: string;
  status: string;
  progress_percentage: number;
}

interface StudentCertificate {
  id: number;
  certificate_number: string;
  course_title: string;
  issued_at: string;
  is_revoked: boolean;
}

interface QuizAttempt {
  id: number;
  quiz_title: string;
  attempt_number: number;
  score: number;
  total_marks: number;
  percentage: number;
  passed: boolean;
}

interface StudentDetail {
  id: number;
  full_name: string;
  enrollment_number: string;
  email?: string;
  semester?: number;
  department: string;
  program?: string;
  academic_year?: string;
  enrollments?: StudentEnrollment[];
  certificates?: StudentCertificate[];
  quiz_attempts?: QuizAttempt[];
}

interface CourseOption {
  id: number;
  title: string;
  course_code: string;
}

export default function AdminStudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const studentId = params?.studentId as string;

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [coursesList, setCoursesList] = useState<CourseOption[]>([]);

  // Edit Student Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editSem, setEditSem] = useState("");
  const [editProgram, setEditProgram] = useState("");
  const [editAcaYear, setEditAcaYear] = useState("");
  const [savingStudent, setSavingStudent] = useState(false);

  // Enroll in Course Modal State
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  // Edit Enrollment Modal State
  const [editingEnrollment, setEditingEnrollment] =
    useState<StudentEnrollment | null>(null);
  const [editEnrollStatus, setEditEnrollStatus] = useState("ENROLLED");
  const [editEnrollProgress, setEditEnrollProgress] = useState("0");
  const [savingEnrollment, setSavingEnrollment] = useState(false);

  // Issue Certificate Modal State
  const [showIssueCertModal, setShowIssueCertModal] = useState(false);
  const [certCourseId, setCertCourseId] = useState("");
  const [issuingCert, setIssuingCert] = useState(false);

  const loadStudent = useCallback(async () => {
    try {
      const data = (await fetchApi(
        `/api/admin/students/${studentId}`,
      )) as StudentDetail;
      setStudent(data);
    } catch (err) {
      console.error("Failed to load student details:", err);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  const loadCourses = useCallback(async () => {
    try {
      const data = await fetchApi<CourseOption[]>("/api/admin/courses");
      setCoursesList(data);
      if (data.length > 0) {
        setSelectedCourseId(String(data[0].id));
        setCertCourseId(String(data[0].id));
      }
    } catch (err) {
      console.error("Failed to load courses for dropdown:", err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=/admin/students/${studentId}`);
      return;
    }
    if (user && user.role !== "STUDENT" && studentId) {
      void Promise.resolve().then(() => {
        loadStudent();
        loadCourses();
      });
    }
  }, [user, authLoading, studentId, router, loadStudent, loadCourses]);

  // Edit Student
  const handleOpenEditStudent = () => {
    if (!student) return;
    setEditFullName(student.full_name);
    setEditEmail(student.email || "");
    setEditDept(student.department || "");
    setEditSem(student.semester ? String(student.semester) : "6");
    setEditProgram(student.program || "B.Tech ECE");
    setEditAcaYear(student.academic_year || "2026-2027");
    setShowEditModal(true);
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !editFullName.trim()) return;
    setSavingStudent(true);
    try {
      await fetchApi(`/api/admin/students/${student.id}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: editFullName.trim(),
          email: editEmail.trim() || undefined,
          department: editDept.trim(),
          semester: editSem ? parseInt(editSem) : undefined,
          program: editProgram.trim() || undefined,
          academic_year: editAcaYear.trim() || undefined,
        }),
      });
      setShowEditModal(false);
      await loadStudent();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to update student profile",
      );
    } finally {
      setSavingStudent(false);
    }
  };

  const handleDeleteStudent = async () => {
    if (!student) return;
    if (
      !confirm(
        `Are you sure you want to permanently delete student "${student.full_name} (${student.enrollment_number})"?\n\nThis removes their login credentials, progress, and all certificates.`,
      )
    ) {
      return;
    }
    try {
      await fetchApi(`/api/admin/students/${student.id}`, { method: "DELETE" });
      router.push("/admin/students");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete student");
    }
  };

  // Enroll in Course
  const handleEnrollCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !selectedCourseId) return;
    setEnrolling(true);
    try {
      await fetchApi(`/api/admin/students/${student.id}/enroll`, {
        method: "POST",
        body: JSON.stringify({ course_id: parseInt(selectedCourseId) }),
      });
      setShowEnrollModal(false);
      await loadStudent();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to enroll student");
    } finally {
      setEnrolling(false);
    }
  };

  // Edit Enrollment
  const handleOpenEditEnrollment = (enr: StudentEnrollment) => {
    setEditingEnrollment(enr);
    setEditEnrollStatus(enr.status);
    setEditEnrollProgress(String(enr.progress_percentage || 0));
  };

  const handleSaveEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEnrollment) return;
    setSavingEnrollment(true);
    try {
      await fetchApi(`/api/admin/enrollments/${editingEnrollment.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: editEnrollStatus,
          progress_percentage: parseFloat(editEnrollProgress) || 0,
        }),
      });
      setEditingEnrollment(null);
      await loadStudent();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update enrollment");
    } finally {
      setSavingEnrollment(false);
    }
  };

  const handleUnenrollCourse = async (enrId: number, courseTitle: string) => {
    if (
      !confirm(
        `Are you sure you want to unenroll student from "${courseTitle}"?`,
      )
    )
      return;
    try {
      await fetchApi(`/api/admin/enrollments/${enrId}`, { method: "DELETE" });
      await loadStudent();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to unenroll student");
    }
  };

  // Issue Certificate
  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student || !certCourseId) return;
    setIssuingCert(true);
    try {
      await fetchApi("/api/admin/certificates/issue", {
        method: "POST",
        body: JSON.stringify({
          student_id: student.id,
          course_id: parseInt(certCourseId),
        }),
      });
      setShowIssueCertModal(false);
      await loadStudent();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to issue certificate");
    } finally {
      setIssuingCert(false);
    }
  };

  const handleDeleteCertificate = async (certId: number, certNum: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete certificate ${certNum}?`,
      )
    )
      return;
    try {
      await fetchApi(`/api/admin/certificates/${certId}`, { method: "DELETE" });
      await loadStudent();
    } catch (err: unknown) {
      alert(
        err instanceof Error ? err.message : "Failed to delete certificate",
      );
    }
  };

  if (authLoading || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!student) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/admin/students"
          className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Students Roster</span>
        </Link>
      </div>

      {/* Student Profile Card */}
      <Card className="border-border-subtle shadow-xs">
        <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">
              ECE Student Profile
            </span>
            <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
              {student.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary pt-1">
              <span className="font-mono font-medium text-text-primary bg-[#F0F3F8] px-2 py-0.5 rounded">
                Enrollment: {student.enrollment_number}
              </span>
              <span>&bull;</span>
              <span>{student.email || "No email"}</span>
              <span>&bull;</span>
              <span>Semester {student.semester || "N/A"}</span>
              <span>&bull;</span>
              <span>{student.department}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenEditStudent}
              className="gap-1.5 h-8 text-xs text-slate-700 hover:text-primary"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteStudent}
              className="gap-1.5 h-8 text-xs text-rose-600 hover:bg-rose-50 hover:border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enrolled Courses & Progress */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary">
              Enrolled Courses & Progress
            </h2>
            <Badge variant="secondary" className="text-xs">
              {student.enrollments?.length || 0}
            </Badge>
          </div>

          <Button
            size="sm"
            onClick={() => setShowEnrollModal(true)}
            className="bg-primary hover:bg-primary-dark text-white gap-1.5 h-8 text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Enroll in Course</span>
          </Button>
        </div>

        {student.enrollments?.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted bg-white rounded-xl border border-border-subtle space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <div>Student is not currently enrolled in any courses.</div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowEnrollModal(true)}
              className="text-xs mt-2"
            >
              + Enroll First Course
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {student.enrollments?.map((e: StudentEnrollment) => (
              <Card
                key={e.id}
                className="p-4 border-border-subtle space-y-3 shadow-xs"
              >
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-sm font-semibold text-text-primary line-clamp-1">
                    {e.course_title}
                  </h3>
                  <Badge
                    variant={e.status === "COMPLETED" ? "success" : "secondary"}
                    className="text-[10px] shrink-0"
                  >
                    {e.status}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>Progress</span>
                    <span className="font-semibold text-primary">
                      {Math.round(e.progress_percentage)}%
                    </span>
                  </div>
                  <Progress
                    value={e.progress_percentage}
                    indicatorColor={
                      e.status === "COMPLETED" ? "bg-emerald-600" : "bg-primary"
                    }
                  />
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenEditEnrollment(e)}
                    className="h-7 text-[11px] text-slate-600 hover:text-primary px-2"
                  >
                    <Edit3 className="w-3 h-3 mr-1" />
                    <span>Edit Status</span>
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleUnenrollCourse(e.id, e.course_title)}
                    className="h-7 text-[11px] text-rose-600 hover:bg-rose-50 px-2"
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    <span>Unenroll</span>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Certificates Awarded */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-text-primary">
              Issued Certificates
            </h2>
            <Badge variant="success" className="text-xs">
              {student.certificates?.length || 0}
            </Badge>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowIssueCertModal(true)}
            className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5 h-8 text-xs font-medium"
          >
            <Award className="w-3.5 h-3.5" />
            <span>+ Issue Certificate</span>
          </Button>
        </div>

        {student.certificates?.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-muted bg-white rounded-xl border border-border-subtle">
            No certificates issued yet. Certificates are automatically awarded
            on course completion or can be manually issued above.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {student.certificates?.map((c: StudentCertificate) => (
              <Card
                key={c.id}
                className="p-4 border-border-subtle flex flex-col justify-between gap-3 shadow-xs"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-mono text-xs font-bold text-[#142250]">
                      {c.certificate_number}
                    </div>
                    <div className="text-xs font-semibold text-slate-800 mt-0.5">
                      {c.course_title}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Issued: {c.issued_at}
                    </div>
                  </div>

                  <Badge
                    variant={c.is_revoked ? "destructive" : "success"}
                    className="text-[10px]"
                  >
                    {c.is_revoked ? "Revoked" : "Active"}
                  </Badge>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100">
                  <Link
                    href={`/verify/${c.certificate_number}`}
                    target="_blank"
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 gap-1"
                    >
                      <span>Verify</span>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      handleDeleteCertificate(c.id, c.certificate_number)
                    }
                    className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quiz Attempt History */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-text-primary">
          Assessment Attempt History
        </h2>

        {student.quiz_attempts?.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-white rounded-xl border border-border-subtle">
            No quiz attempts recorded yet.
          </div>
        ) : (
          <Card className="border-border-subtle overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-border-subtle text-slate-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="p-3">Quiz Title</th>
                  <th className="p-3 text-center">Attempt #</th>
                  <th className="p-3 text-center">Score</th>
                  <th className="p-3 text-center">Percentage</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {student.quiz_attempts?.map((a: QuizAttempt) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-3 font-medium text-slate-800">
                      {a.quiz_title}
                    </td>
                    <td className="p-3 text-center font-mono">
                      Attempt {a.attempt_number}
                    </td>
                    <td className="p-3 text-center font-semibold">
                      {a.score} / {a.total_marks}
                    </td>
                    <td className="p-3 text-center font-bold">
                      {a.percentage}%
                    </td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={a.passed ? "success" : "destructive"}
                        className="text-[10px]"
                      >
                        {a.passed ? "Passed" : "Failed"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* ─── Modal: Edit Student Dialog ───────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit Student Profile
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Full Name *</label>
                <Input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Department
                </label>
                <Input
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-text-primary">
                    Program
                  </label>
                  <Input
                    value={editProgram}
                    onChange={(e) => setEditProgram(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-text-primary">
                    Semester
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={editSem}
                    onChange={(e) => setEditSem(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">
                  Academic Year
                </label>
                <Input
                  value={editAcaYear}
                  onChange={(e) => setEditAcaYear(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={savingStudent}
                  className="bg-primary text-white font-semibold"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Enroll in Course Dialog ───────────────────────────────────── */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Enroll Student in Course
              </h3>
              <button
                onClick={() => setShowEnrollModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEnrollCourse} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Select Academic Course *
                </label>
                <select
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {coursesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.course_code}] {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowEnrollModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={enrolling}
                  className="bg-primary text-white font-semibold"
                >
                  Confirm Enrollment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Enrollment Dialog ────────────────────────────────────── */}
      {editingEnrollment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Enrollment Status
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {editingEnrollment.course_title}
                </p>
              </div>
              <button
                onClick={() => setEditingEnrollment(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEnrollment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Enrollment Status *
                </label>
                <select
                  value={editEnrollStatus}
                  onChange={(e) => setEditEnrollStatus(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="ENROLLED">ENROLLED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  Progress Percentage (0 - 100%)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={editEnrollProgress}
                  onChange={(e) => setEditEnrollProgress(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingEnrollment(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={savingEnrollment}
                  className="bg-primary text-white font-semibold"
                >
                  Update Enrollment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Manual Issue Certificate Dialog ───────────────────────────── */}
      {showIssueCertModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Issue Academic Certificate
              </h3>
              <button
                onClick={() => setShowIssueCertModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleIssueCertificate}
              className="space-y-4 text-xs"
            >
              <p className="text-slate-600">
                Issuing certificate for <strong>{student.full_name}</strong> (
                {student.enrollment_number}).
              </p>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Course *</label>
                <select
                  value={certCourseId}
                  onChange={(e) => setCertCourseId(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {coursesList.map((c) => (
                    <option key={c.id} value={c.id}>
                      [{c.course_code}] {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowIssueCertModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={issuingCert}
                  className="bg-emerald-700 text-white font-semibold"
                >
                  Generate & Issue Certificate
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
