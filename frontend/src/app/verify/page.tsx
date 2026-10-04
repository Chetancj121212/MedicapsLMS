"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Award, Search } from "lucide-react";

export default function VerifyIndexPage() {
  const router = useRouter();
  const [certId, setCertId] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!certId.trim()) return;
    router.push(`/verify/${certId.trim().toUpperCase()}`);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/8 text-primary text-xs font-semibold border border-primary/15">
          <span>Credential Registry</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-text-primary tracking-tight">
          Verify Certificate
        </h1>
        <p className="text-xs text-text-secondary max-w-md mx-auto">
          Enter the unique Certificate ID located at the bottom of the printed
          certificate or scan the QR code.
        </p>
      </div>

      <Card className="border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.03)] bg-white">
        <form onSubmit={handleSearch}>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Certificate ID Number
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="e.g. ECE-2026-000001"
                  value={certId}
                  onChange={(e) => setCertId(e.target.value)}
                  className="pl-8 font-mono uppercase text-sm h-9"
                  required
                />
                <Award className="w-4 h-4 text-text-muted absolute left-2.5 top-2.5" />
              </div>
            </div>

            <Button type="submit" size="md" className="w-full gap-2 h-10">
              <Search className="w-4 h-4" />
              <span>Verify Credential Authenticity</span>
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* Demo helper */}
      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            setCertId("ECE-2026-000001");
            router.push("/verify/ECE-2026-000001");
          }}
          className="text-xs text-primary hover:underline font-medium cursor-pointer"
        >
          Verify seeded demo certificate: ECE-2026-000001 &rarr;
        </button>
      </div>
    </div>
  );
}
