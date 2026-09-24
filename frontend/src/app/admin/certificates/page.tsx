"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { fetchApi, getCertificateDownloadUrl } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Plus,
  Trash2,
} from "lucide-react";

interface AdminCertificateItem {
  id: number;
  certificate_number: string;
  student_name: string;
  enrollment_number: string;
  course_title: string;
  issued_at: string;
  is_revoked: boolean;
  revoked_at?: string;
}

interface StudentOption {
  id: number;
  full_name: string;
  enrollment_number: string;
}

interface CourseOption {
  id: number;
  title: string;
  course_code: string;
}

export default function AdminCertificatesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [certificates, setCertificates] = useState<AdminCertificateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Manual Issue Modal State
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [studentsList, setStudentsList] = useState<StudentOption[]>([]);
  const [coursesList, setCoursesList] = useState<CourseOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [issuing, setIssuing] = useState(false);

  const loadCertificates = useCallback(async () => {
    try {
      const data = await fetchApi<AdminCertificateItem[]>("/api/admin/certificates");
      setCertificates(data);
    } catch (err) {
      console.error("Failed to load certificates:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDropdownData = useCallback(async () => {
    try {
      const [studs, crss] = await Promise.all([
        fetchApi<StudentOption[]>("/api/admin/students"),
        fetchApi<CourseOption[]>("/api/admin/courses"),
      ]);
      setStudentsList(studs);
      setCoursesList(crss);
      if (studs.length > 0) setSelectedStudentId(String(studs[0].id));
      if (crss.length > 0) setSelectedCourseId(String(crss[0].id));
    } catch (err) {
      console.error("Failed to load dropdown data:", err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/admin/certificates");
      return;
    }
    if (user && user.role !== "STUDENT") {
      loadCertificates();
      loadDropdownData();
    }
  }, [user, authLoading, router, loadCertificates, loadDropdownData]);

  const handleToggleRevoke = async (cert: AdminCertificateItem) => {
    const action = cert.is_revoked ? "restore" : "revoke";
    if (!confirm(`Are you sure you want to ${action} certificate ${cert.certificate_number}?`)) {
      return;
    }

    setTogglingId(cert.id);
    try {
      await fetchApi(`/api/admin/certificates/${cert.id}/revoke`, {
        method: "POST",
      });
      loadCertificates();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update revocation status");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteCertificate = async (cert: AdminCertificateItem) => {
    if (
      !confirm(
        `Are you sure you want to permanently delete certificate ${cert.certificate_number} issued to ${cert.student_name}?`
      )
    ) {
      return;
    }

    setDeletingId(cert.id);
    try {
      await fetchApi(`/api/admin/certificates/${cert.id}`, { method: "DELETE" });
      loadCertificates();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete certificate");
    } finally {
      setDeletingId(null);
    }
  };

  const handleIssueCertificate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedCourseId) return;

    setIssuing(true);
    try {
      await fetchApi("/api/admin/certificates/issue", {
        method: "POST",
        body: JSON.stringify({
          student_id: parseInt(selectedStudentId),
          course_id: parseInt(selectedCourseId),
        }),
      });
      setShowIssueModal(false);
      loadCertificates();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to issue certificate");
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <Link
            href="/admin"
            className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Admin Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            Certificate Registry & Revocation
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Department of Electronics Engineering &bull; Monitor issued digital credentials, issue new certificates, and handle revocations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs font-medium text-text-secondary bg-[#F7F8FA] px-3 py-1.5 rounded-lg border border-border-subtle">
            Total Issued: <span className="text-primary font-semibold">{certificates.length}</span>
          </div>

          <Button
            size="sm"
            onClick={() => setShowIssueModal(true)}
            className="bg-primary hover:bg-primary-dark text-white gap-1.5 h-8 text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Issue Certificate</span>
          </Button>
        </div>
      </div>

      {/* Certificates Table */}
      <Card className="border-border-subtle overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F7F8FA] border-b border-border-subtle text-text-secondary font-semibold uppercase text-[11px]">
              <tr>
                <th className="p-4">Certificate ID</th>
                <th className="p-4">Student & Enrollment</th>
                <th className="p-4">Course Title</th>
                <th className="p-4">Issue Date</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-400">
                    Loading credentials registry...
                  </td>
                </tr>
              ) : certificates.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    No certificates have been issued yet. Click &ldquo;+ Issue Certificate&rdquo; above to create one.
                  </td>
                </tr>
              ) : (
                certificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono font-bold text-[#142250]">
                      {cert.certificate_number}
                    </td>

                    <td className="p-4">
                      <div className="font-semibold text-slate-900">{cert.student_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{cert.enrollment_number}</div>
                    </td>

                    <td className="p-4 font-medium text-slate-800">
                      {cert.course_title}
                    </td>

                    <td className="p-4 text-slate-600">
                      {cert.issued_at}
                    </td>

                    <td className="p-4 text-center">
                      <Badge variant={cert.is_revoked ? "destructive" : "success"} className="text-[10px]">
                        {cert.is_revoked ? "Revoked" : "Authentic"}
                      </Badge>
                    </td>

                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      <Link href={`/verify/${cert.certificate_number}`} target="_blank">
                        <Button size="sm" variant="outline" className="text-xs h-7 px-2">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          <span>Verify</span>
                        </Button>
                      </Link>

                      <a
                        href={getCertificateDownloadUrl(cert.certificate_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button size="sm" variant="ghost" className="text-xs h-7 px-2 text-slate-600" title="Download PDF">
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </a>

                      {/* Revoke Toggle Button */}
                      <Button
                        size="sm"
                        variant={cert.is_revoked ? "secondary" : "destructive"}
                        onClick={() => handleToggleRevoke(cert)}
                        isLoading={togglingId === cert.id}
                        className="text-xs h-7 px-2.5"
                      >
                        {cert.is_revoked ? "Restore" : "Revoke"}
                      </Button>

                      {/* Delete Certificate Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteCertificate(cert)}
                        isLoading={deletingId === cert.id}
                        className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50"
                        title="Delete Record"
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

      {/* ─── Modal: Manual Issue Certificate Dialog ───────────────────────────── */}
      {showIssueModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Issue Academic Certificate</h3>
              <button onClick={() => setShowIssueModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleIssueCertificate} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Select Student *</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full rounded-lg border border-border-subtle p-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                >
                  {studentsList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.enrollment_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Select Course *</label>
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
                <Button type="button" variant="outline" onClick={() => setShowIssueModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={issuing} className="bg-emerald-700 text-white font-semibold">
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
