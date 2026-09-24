"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Lock, User, AlertCircle, Eye, EyeOff, Key } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect");

  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("Please enter both username/enrollment number and password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await login(username, password);
      if (redirectUrl) {
        router.push(redirectUrl);
      } else if (res.role === "STUDENT") {
        router.push("/student");
      } else {
        router.push("/admin");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fillCredentials = (userVal: string, passVal: string) => {
    setUsername(userVal);
    setPassword(passVal);
    setError(null);
  };

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col items-center justify-center px-4 py-8 bg-[#F7F8FA]">
      <div className="w-full max-w-[380px] space-y-4">
        {/* Academic Portal Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center pb-1">
            <img
              src="/medicaps-logo.png"
              alt="Medicaps Faculty of Engineering"
              className="h-11 w-auto object-contain"
            />
          </div>
          <div className="text-[11px] font-semibold tracking-wider text-primary uppercase">
            ECE COURSE PORTAL
          </div>
          <h1 className="text-xl font-semibold text-text-primary tracking-tight">
            Student & Faculty Authentication
          </h1>
        </div>

        {/* Primary Login Card */}
        <Card className="border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.03)] bg-white">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 p-5">
              {error && (
                <div className="p-2.5 rounded-lg bg-primary/8 border border-primary/20 flex items-start gap-2 text-xs text-primary">
                  <AlertCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-primary">
                  Enrollment Number / Username
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="e.g. DEMO001 or admin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-8 text-sm h-9"
                    required
                  />
                  <User className="w-4 h-4 text-text-muted absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-text-primary">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8 pr-9 text-sm h-9"
                    required
                  />
                  <Lock className="w-4 h-4 text-text-muted absolute left-2.5 top-2.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 font-medium text-sm mt-2"
                isLoading={loading}
              >
                Sign In
              </Button>
            </CardContent>
          </form>
        </Card>

        {/* Muted Developer Demo Access Panel */}
        <div className="bg-white border border-border-subtle rounded-lg p-3 space-y-2 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            <Key className="w-3.5 h-3.5 text-primary-secondary" />
            <span>DEMO ACCESS</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <button
              type="button"
              onClick={() => fillCredentials("DEMO001", "Demo@123")}
              className="p-2 rounded border border-border-subtle bg-[#F7F8FA] hover:bg-[#F0F3F8] hover:border-primary/30 transition-colors cursor-pointer text-left"
            >
              <div className="text-xs font-semibold text-text-primary">Student</div>
              <div className="text-[10px] text-text-secondary font-mono mt-0.5">DEMO001 / Demo@123</div>
            </button>

            <button
              type="button"
              onClick={() => fillCredentials("admin", "Admin@123")}
              className="p-2 rounded border border-border-subtle bg-[#F7F8FA] hover:bg-[#F0F3F8] hover:border-primary/30 transition-colors cursor-pointer text-left"
            >
              <div className="text-xs font-semibold text-text-primary">Admin</div>
              <div className="text-[10px] text-text-secondary font-mono mt-0.5">admin / Admin@123</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center text-xs text-text-muted">Loading authentication portal...</div>}>
      <LoginForm />
    </Suspense>
  );
}
