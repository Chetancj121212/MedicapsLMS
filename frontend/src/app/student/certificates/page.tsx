"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchApi, getCertificateDownloadUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Award, Download, ArrowLeft, Calendar } from "lucide-react";

interface CertificateItem {
  id: number;
  certificate_number: string;
  course_id: number;
  course_title: string;
  issued_at: string;
  is_revoked: boolean;
}

export default function StudentCertificatesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [certificates, setCertificates] = useState<CertificateItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/student/certificates");
      return;
    }

    async function loadCertificates() {
      try {
        const data = await fetchApi<CertificateItem[]>(
          "/api/certificates/student/my-certificates",
        );
        setCertificates(data);
      } catch (err) {
        console.error("Failed to load certificates:", err);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      loadCertificates();
    }
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[calc(100vh-92px)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-44 bg-slate-200 animate-pulse rounded-xl" />
          <div className="h-44 bg-slate-200 animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-92px)] max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-5">
        <div>
          <Link
            href="/student"
            className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium mb-1.5 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
            Academic Certificates
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Digitally verifiable credentials awarded by the Department of
            Electronics Engineering.
          </p>
        </div>

        <div className="text-xs font-mono bg-[#F7F8FA] text-text-secondary px-3 py-1.5 rounded-lg border border-border-subtle">
          Student ID:{" "}
          <span className="font-semibold text-text-primary">
            {user?.student?.enrollment_number}
          </span>
        </div>
      </div>

      {certificates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-border-subtle p-8 space-y-3">
          <Award className="w-10 h-10 text-text-muted mx-auto" />
          <h3 className="text-sm font-semibold text-text-primary">
            No Certificates Earned Yet
          </h3>
          <p className="text-xs text-text-secondary max-w-md mx-auto">
            Complete all course lectures and required module assessments to
            receive your verified department certificate.
          </p>
          <Link href="/student">
            <Button size="sm" variant="outline">
              Continue Courses
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {certificates.map((cert) => (
            <Card
              key={cert.id}
              className="border-border-subtle overflow-hidden flex flex-col justify-between"
            >
              <div className="p-4 bg-primary-dark text-white flex justify-between items-start border-b border-border-subtle">
                <div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider text-primary-steel">
                    Medicaps University · ECE
                  </div>
                  <div className="font-mono text-xs font-medium text-slate-200 mt-0.5">
                    {cert.certificate_number}
                  </div>
                </div>

                <Badge
                  variant={cert.is_revoked ? "destructive" : "success"}
                  className="text-[10px]"
                >
                  {cert.is_revoked ? "Revoked" : "Authentic & Active"}
                </Badge>
              </div>

              <CardHeader className="py-4 px-5 space-y-1">
                <CardTitle className="text-[15px] font-semibold text-text-primary leading-snug">
                  {cert.course_title}
                </CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-text-secondary pt-1">
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                  <span>Awarded: {cert.issued_at}</span>
                </div>
              </CardHeader>

              <CardFooter className="pt-2 pb-4 px-5 border-t border-border-subtle flex items-center justify-between gap-2">
                <a
                  href={getCertificateDownloadUrl(cert.certificate_number)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button size="sm" className="gap-1.5 h-8 text-xs">
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </Button>
                </a>

                <Link href={`/verify/${cert.certificate_number}`}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 h-8 text-xs text-primary border-border-subtle"
                  >
                    <span>Verify QR Record</span>
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
