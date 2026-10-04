"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchApi, getCertificateDownloadUrl } from "@/lib/api";
import { VerificationResponse } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Download,
  Building,
  Calendar,
  User,
  GraduationCap,
  Search,
} from "lucide-react";

export default function CertificateVerificationPage() {
  const params = useParams();
  const certificateId = params?.certificateId as string;

  const [data, setData] = useState<VerificationResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetchApi<VerificationResponse>(
          `/api/certificates/verify/${certificateId}`,
        );
        setData(res);
      } catch (err: unknown) {
        setData({
          valid: false,
          message:
            err instanceof Error
              ? err.message
              : "Failed to contact verification server",
        });
      } finally {
        setLoading(false);
      }
    }
    if (certificateId) {
      verify();
    }
  }, [certificateId]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
          <span>Official Public Credential Registry</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
          Certificate Verification
        </h1>
        <p className="text-xs text-text-secondary">
          Department of Electronics Engineering &bull; Medicaps University,
          Indore
        </p>
      </div>

      {loading ? (
        <Card className="p-8 space-y-6 border-border-subtle">
          <Skeleton className="h-8 w-48 mx-auto" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-2/3" />
          </div>
        </Card>
      ) : !data || (!data.valid && !data.certificate?.revoked) ? (
        /* Invalid State */
        <Card className="border-primary/30 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="bg-primary text-white p-5 text-center space-y-2">
            <XCircle className="w-10 h-10 mx-auto text-white" />
            <h2 className="text-xl font-semibold">Certificate Not Found</h2>
            <p className="text-xs text-red-100 font-mono">{certificateId}</p>
          </div>

          <CardContent className="p-6 text-center space-y-5">
            <p className="text-xs sm:text-sm text-text-secondary max-w-md mx-auto">
              The certificate ID{" "}
              <span className="font-mono font-semibold text-text-primary">
                {certificateId}
              </span>{" "}
              could not be verified against the official records of Medicaps
              University.
            </p>

            <div className="bg-[#F7F8FA] border border-border-subtle rounded-lg p-4 text-xs text-text-secondary max-w-md mx-auto text-left space-y-1.5">
              <div className="font-semibold text-text-primary">
                Possible reasons:
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>The certificate ID was entered incorrectly</li>
                <li>
                  The course was not completed or certificate was never issued
                </li>
                <li>The credential may be invalid or expired</li>
              </ul>
            </div>

            <Link href="/verify">
              <Button variant="outline" size="sm" className="gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Search Another Certificate</span>
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : data.certificate?.revoked ? (
        /* Revoked State */
        <Card className="border-primary/30 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
          <div className="bg-primary text-white p-5 text-center space-y-2">
            <AlertTriangle className="w-10 h-10 mx-auto text-red-100" />
            <h2 className="text-xl font-semibold">Certificate Revoked</h2>
            <p className="text-xs text-red-100 font-mono">{certificateId}</p>
          </div>

          <CardContent className="p-6 space-y-5">
            <div className="p-3 bg-primary/8 rounded-lg border border-primary/20 text-xs text-primary text-center font-medium">
              This certificate is no longer considered valid. It has been
              officially revoked by the Department of Electronics Engineering.
            </div>

            <div className="divide-y divide-border-subtle text-xs">
              <div className="py-2.5 flex justify-between">
                <span className="text-text-secondary">Student Name</span>
                <span className="font-semibold text-text-primary">
                  {data.certificate.studentName}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-text-secondary">Course</span>
                <span className="font-semibold text-text-primary">
                  {data.certificate.courseName}
                </span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-text-secondary">Status</span>
                <span className="font-bold text-primary">REVOKED</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Valid Authentic State */
        <Card className="border-border-subtle bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Top Banner */}
          <div className="bg-primary-dark text-white p-6 text-center space-y-1.5 border-b border-primary-secondary/40">
            <div className="inline-flex p-1.5 bg-white/10 rounded-full mb-1">
              <CheckCircle2 className="w-8 h-8 text-primary-steel" />
            </div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary-steel">
              Verified Academic Credential
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Authentic Certificate
            </h2>
            <div className="font-mono text-xs bg-white/10 px-3 py-1 rounded text-white mt-1 inline-block">
              {data.certificate?.certificateNumber}
            </div>
          </div>

          <CardContent className="p-6 sm:p-7 space-y-5">
            <div className="p-3 bg-primary/8 rounded-lg border border-primary/15 text-xs text-text-primary flex items-center gap-2">
              <span>
                <strong>Official Record:</strong> This certificate is authentic
                and was officially awarded by Medicaps University.
              </span>
            </div>

            {/* Certificate Details Table */}
            <div className="divide-y divide-border-subtle text-xs sm:text-sm">
              <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-text-secondary text-xs flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-text-muted" />
                  <span>Student Name</span>
                </span>
                <span className="font-semibold text-text-primary text-sm">
                  {data.certificate?.studentName}
                </span>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-text-secondary text-xs flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-text-muted" />
                  <span>Enrollment Number</span>
                </span>
                <span className="font-mono font-medium text-text-primary">
                  {data.certificate?.enrollmentNumber}
                </span>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-text-secondary text-xs flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-text-muted" />
                  <span>Course Title</span>
                </span>
                <span className="font-semibold text-text-primary text-right">
                  {data.certificate?.courseName}
                </span>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-text-secondary text-xs flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-text-muted" />
                  <span>Department & Institution</span>
                </span>
                <span className="text-text-primary text-right text-xs font-medium">
                  {data.certificate?.department} &bull;{" "}
                  {data.certificate?.institution}
                </span>
              </div>

              <div className="py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className="text-text-secondary text-xs flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-text-muted" />
                  <span>Completion Date</span>
                </span>
                <span className="font-medium text-text-primary">
                  {data.certificate?.issuedAt}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={getCertificateDownloadUrl(certificateId as string)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="sm"
                  className="w-full sm:w-auto gap-2 h-9 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Official PDF</span>
                </Button>
              </a>

              <Link href="/courses">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto h-9 text-xs"
                >
                  Browse ECE Courses
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
