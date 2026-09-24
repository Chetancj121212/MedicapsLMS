"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  Search,
  Plus,
  FileSpreadsheet,
  KeyRound,
  Eye,
  ArrowLeft,
  Edit3,
  Trash2,
} from "lucide-react";

interface StudentListItem {
  id: number;
  full_name: string;
  enrollment_number: string;
  email?: string;
  department: string;
  semester?: number;
  program?: string;
  academic_year?: string;
  enrolled_count: number;
  certificates_count: number;
}

interface SelectedStudent {
  id: number;
  full_name: string;
  enrollment_number: string;
}

export default function AdminStudentsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SelectedStudent | null>(null);

  // Edit student form state
  const [editStudentId, setEditStudentId] = useState<number | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editSemester, setEditSemester] = useState("");
  const [editProgram, setEditProgram] = useState("");
  const [editAcademicYear, setEditAcademicYear] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Add student form state
  const [fullName, setFullName] = useState("");
  const [enrollmentNumber, setEnrollmentNumber] = useState("");
  const [password, setPassword] = useState("Medicaps@123");
  const [email, setEmail] = useState("");
  const [semester, setSemester] = useState("6");
  const [addingStudent, setAddingStudent] = useState(false);

  // CSV file state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Password reset state
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/students");
      return;
    }
    if (user && user.role !== "STUDENT") {
      loadStudents();
    }
  }, [user, authLoading, router]);

  async function loadStudents(query?: string) {
    try {
      const url = query ? `/api/admin/students?search=${encodeURIComponent(query)}` : "/api/admin/students";
      const data = await fetchApi<StudentListItem[]>(url);
      setStudents(data);
    } catch (err) {
      console.error("Failed to load students:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadStudents(search);
  };

  const handleStartEdit = (stud: StudentListItem) => {
    setEditStudentId(stud.id);
    setEditFullName(stud.full_name);
    setEditEmail(stud.email || "");
    setEditDepartment(stud.department || "Electronics and Communication Engineering");
    setEditSemester(stud.semester ? String(stud.semester) : "6");
    setEditProgram(stud.program || "B.Tech ECE");
    setEditAcademicYear(stud.academic_year || "2026-2027");
    setShowEditModal(true);
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudentId || !editFullName.trim()) return;

    setSavingEdit(true);
    try {
      await fetchApi(`/api/admin/students/${editStudentId}`, {
        method: "PUT",
        body: JSON.stringify({
          full_name: editFullName.trim(),
          email: editEmail.trim() || undefined,
          department: editDepartment.trim(),
          semester: editSemester ? parseInt(editSemester) : undefined,
          program: editProgram.trim() || undefined,
          academic_year: editAcademicYear.trim() || undefined,
        }),
      });
      setShowEditModal(false);
      setEditStudentId(null);
      await loadStudents(search);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update student profile");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteStudent = async (stud: StudentListItem) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete student:\n\n${stud.full_name} (${stud.enrollment_number})\n\nThis will remove their user login, course progress, quiz attempts, and certificates.`
      )
    ) {
      return;
    }

    try {
      await fetchApi(`/api/admin/students/${stud.id}`, { method: "DELETE" });
      await loadStudents(search);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete student");
    }
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !enrollmentNumber || !password) return;

    setAddingStudent(true);
    try {
      await fetchApi("/api/admin/students", {
        method: "POST",
        body: JSON.stringify({
          full_name: fullName.trim(),
          enrollment_number: enrollmentNumber.trim(),
          password: password,
          email: email.trim() || undefined,
          semester: semester ? parseInt(semester) : undefined,
          department: "Electronics and Communication Engineering",
        }),
      });

      setShowAddModal(false);
      setFullName("");
      setEnrollmentNumber("");
      setEmail("");
      loadStudents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to add student");
    } finally {
      setAddingStudent(false);
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setUploadingCsv(true);
    try {
      const formData = new FormData();
      formData.append("file", csvFile);

      const res = await fetchApi("/api/admin/students/import-csv", {
        method: "POST",
        body: formData,
      });

      alert(`Successfully imported ${(res as { created_count: number }).created_count} students!`);
      setShowCsvModal(false);
      setCsvFile(null);
      loadStudents();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to import CSV");
    } finally {
      setUploadingCsv(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !newPassword) return;

    setResetting(true);
    try {
      await fetchApi(`/api/admin/students/${selectedStudent.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      });
      alert(`Password updated for ${selectedStudent.full_name}!`);
      setShowResetModal(false);
      setNewPassword("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link href="/admin" className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            Student Management & Roster
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Department of Electronics Engineering &bull; Manage student accounts, imports, and progress records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowCsvModal(true)}
            className="gap-1.5 h-8 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
            <span>Import CSV</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="bg-primary hover:bg-primary-dark text-white gap-1.5 h-8 text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="max-w-md flex gap-2">
        <div className="relative flex-1">
          <Input
            placeholder="Search by name, enrollment, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
      </form>

      {/* Students Table (Section 29) */}
      <Card className="border-slate-300 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F0F3F8] border-b-2 border-slate-300 text-slate-700 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-4">Student Name</th>
                <th className="p-4">Enrollment Number</th>
                <th className="p-4">Department & Sem</th>
                <th className="p-4 text-center">Enrolled</th>
                <th className="p-4 text-center">Certificates</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Loading student directory...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No students found. Add a student or import via CSV.
                  </td>
                </tr>
              ) : (
                students.map((stud) => (
                  <tr key={stud.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-semibold text-slate-900">
                      <div>{stud.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-normal">{stud.email || "No email"}</div>
                    </td>

                    <td className="p-4 font-mono font-bold text-[#142250]">
                      {stud.enrollment_number}
                    </td>

                    <td className="p-4 text-slate-600">
                      <div>{stud.department}</div>
                      <div className="text-[11px] text-slate-400">Semester {stud.semester || "N/A"}</div>
                    </td>

                    <td className="p-4 text-center font-bold text-slate-700">
                      {stud.enrolled_count}
                    </td>

                    <td className="p-4 text-center">
                      <Badge variant={stud.certificates_count > 0 ? "success" : "secondary"}>
                        {stud.certificates_count}
                      </Badge>
                    </td>

                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      <Link href={`/admin/students/${stud.id}`}>
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>View</span>
                        </Button>
                      </Link>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEdit(stud)}
                        className="text-xs h-7 px-2 text-slate-700 hover:text-primary"
                        title="Edit Student Profile"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedStudent(stud);
                          setShowResetModal(true);
                        }}
                        className="text-xs h-7 px-2 text-slate-600 hover:text-amber-700"
                        title="Reset Password"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteStudent(stud)}
                        className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                        title="Delete Student"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ─── Modal: Add Student Dialog ────────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Add New Student</h3>
            <form onSubmit={handleAddStudent} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Full Name *</label>
                <Input
                  placeholder="e.g. Chetan Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Enrollment Number *</label>
                <Input
                  placeholder="e.g. DEMO002"
                  value={enrollmentNumber}
                  onChange={(e) => setEnrollmentNumber(e.target.value)}
                  className="text-sm font-mono uppercase"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Temporary Password *</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-sm font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Email Address</label>
                  <Input
                    type="email"
                    placeholder="student@medicaps.ac.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Semester</label>
                  <Input
                    type="number"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={addingStudent} className="bg-primary text-white">
                  Add Student
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Import CSV Dialog ─────────────────────────────────────────── */}
      {showCsvModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <span>Import Students via CSV</span>
            </h3>
            <p className="text-xs text-slate-500">
              Upload a CSV file containing columns: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">full_name, enrollment_number, password, email, semester</code>
            </p>

            <form onSubmit={handleImportCsv} className="space-y-4 text-xs">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-5 text-center hover:bg-slate-50 transition-colors">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                  required
                />
                <p className="text-[11px] text-slate-400 mt-2">
                  {csvFile ? `Selected: ${csvFile.name}` : "Select a .csv file from your computer"}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowCsvModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={uploadingCsv} className="bg-emerald-700 text-white font-semibold">
                  Upload & Import
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Password Reset Dialog ─────────────────────────────────────── */}
      {showResetModal && selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Reset Password</span>
            </h3>
            <p className="text-xs text-slate-500">
              Reset password for <strong>{selectedStudent.full_name}</strong> ({selectedStudent.enrollment_number}).
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">New Password</label>
                <Input
                  type="password"
                  placeholder="Enter new password..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="text-sm font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowResetModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={resetting} className="bg-amber-600 text-white font-semibold">
                  Save New Password
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal: Edit Student Dialog ───────────────────────────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Edit Student Profile</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-4 text-xs">
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
                <label className="font-medium text-text-primary">Email Address</label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">Department</label>
                <Input
                  value={editDepartment}
                  onChange={(e) => setEditDepartment(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-medium text-text-primary">Program</label>
                  <Input
                    value={editProgram}
                    onChange={(e) => setEditProgram(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-medium text-text-primary">Semester</label>
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={editSemester}
                    onChange={(e) => setEditSemester(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">Academic Year</label>
                <Input
                  value={editAcademicYear}
                  onChange={(e) => setEditAcademicYear(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                <Button type="button" variant="outline" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={savingEdit} className="bg-primary text-white font-semibold">
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
