"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/Card";
import {
  User,
  GraduationCap,
  Mail,
  ArrowLeft,
  Save,
  ShieldCheck,
} from "lucide-react";

export default function StudentProfilePage() {
  const { user, isLoading: authLoading, refreshUser } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [semester, setSemester] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/student/profile");
      return;
    }
    if (user?.student) {
      setFullName(user.student.full_name);
      setEmail(user.student.email || "");
      setSemester(
        user.student.semester ? user.student.semester.toString() : "",
      );
    }
  }, [user, authLoading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await fetchApi("/api/student/profile", {
        method: "PUT",
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          semester: semester ? parseInt(semester) : undefined,
        }),
      });
      await refreshUser();
      setSuccess(true);
    } catch (error: unknown) {
      alert(getErrorMessage(error, "Failed to update profile"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link
          href="/student"
          className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary tracking-tight">
          Academic Profile
        </h1>
        <p className="text-xs text-text-secondary">
          Department of Electronics Engineering
        </p>
      </div>

      <Card className="border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)] bg-white">
        <form onSubmit={handleSave}>
          <CardContent className="p-6 space-y-4 text-xs">
            {success && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200 font-medium">
                ✓ Profile details updated successfully!
              </div>
            )}

            <div className="space-y-1">
              <label className="font-medium text-text-primary">
                Enrollment Number
              </label>
              <Input
                value={user?.student?.enrollment_number || user?.username || ""}
                disabled
                className="bg-[#F7F8FA] font-mono text-sm cursor-not-allowed text-text-secondary"
              />
              <span className="text-[10px] text-text-muted">
                Enrollment number cannot be changed.
              </span>
            </div>

            <div className="space-y-1">
              <label className="font-medium text-text-primary">Full Name *</label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-sm font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium text-text-primary">
                Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-medium text-text-primary">Department</label>
                <Input
                  value={user?.student?.department || "ECE"}
                  disabled
                  className="bg-[#F7F8FA] text-sm cursor-not-allowed text-text-secondary"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text-primary">Semester</label>
                <Input
                  type="number"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-subtle">
              <Button
                type="submit"
                size="sm"
                isLoading={saving}
                className="gap-1.5 h-9 text-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
