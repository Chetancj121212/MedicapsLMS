"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Lock, User, AlertCircle, Eye, EyeOff, ArrowRight } from "lucide-react";

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
      setError(
        err instanceof Error
          ? err.message
          : "Invalid credentials. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="login-page flex min-h-[calc(100vh-100px)] items-center justify-center bg-white/35 bg-[length:100%_100%] bg-center bg-blend-screen bg-no-repeat px-4 py-8 sm:py-12"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255, 255, 255, 0.68), rgba(255, 255, 255, 0.68)), url('/Misty%20Minimalist%20University%20Campusscape.png')",
        backgroundBlendMode: "screen",
      }}
    >
      <Card className="w-full max-w-[540px] rounded-[18px] border border-[#E3E7EF] bg-white/95 shadow-[0_12px_36px_rgba(27,58,107,0.08)] backdrop-blur-[2px]">
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5 p-6 sm:p-10">
            <div className="text-center">
              <Image
                src="/medicaps-logo.png"
                alt="Medicaps Faculty of Engineering"
                width={200}
                height={80}
                className="mx-auto h-auto w-full max-w-[200px] object-contain"
              />
              <p className="mt-3 text-sm font-medium text-[#1B3A6B]">
                Department of Electronics Engineering
              </p>
              <div className="mx-auto mt-5 flex h-[3px] max-w-[220px] overflow-hidden rounded-full">
                <span className="w-1/2 bg-[#9A1E33]" />
                <span className="w-1/2 bg-[#1B3A6B]" />
              </div>
              <h1 className="mt-7 text-[34px] font-bold leading-tight tracking-[-0.02em]">
                <span className="text-[#1B3A6B]">Student </span>
                <span className="text-[#9A1E33]">Login</span>
              </h1>
              <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-[#60708A]">
                Access your courses, lectures, assessments and certificates.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-[#9A1E33]/20 bg-[#9A1E33]/5 p-3 text-sm text-[#9A1E33]"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-semibold text-[#172033]"
              >
                Enrollment Number / Username
              </label>
              <div className="relative">
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username or enrollment number"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-[50px] rounded-[9px] border-[#DCE4F0] bg-[#F0F4FA] pl-11 text-sm focus:border-[#1B3A6B] focus:ring-[#1B3A6B]"
                  required
                />
                <User className="absolute left-4 top-[17px] h-4 w-4 text-[#60708A]" />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-[#172033]"
              >
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[50px] rounded-[9px] border-[#DCE4F0] bg-[#F0F4FA] pl-11 pr-12 text-sm focus:border-[#1B3A6B] focus:ring-[#1B3A6B]"
                  required
                />
                <Lock className="absolute left-4 top-[17px] h-4 w-4 text-[#60708A]" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 rounded-md p-1 text-[#60708A] transition-colors hover:text-[#1B3A6B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3A6B]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="destructive"
              className="mt-2 h-[52px] w-full rounded-[10px] text-[15px] font-semibold hover:bg-[#7A1525]"
              isLoading={loading}
            >
              <span>{loading ? "Signing In" : "Sign In"}</span>
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </CardContent>
        </form>
      </Card>
    </section>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-xs text-text-muted">
          Loading authentication portal...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
