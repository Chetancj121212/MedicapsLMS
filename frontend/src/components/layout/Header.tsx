"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const isStudent = user?.role === "STUDENT";
  const isAdmin = user && user.role !== "STUDENT";
  const hideMainNavigation = pathname.startsWith("/student/courses/");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-white/95 backdrop-blur-xs">
      {/* Top Academic Sub-bar */}
      <div
        className="text-white/90 text-xs py-1.5 px-4 sm:px-8 flex justify-between items-center shadow-xs"
        style={{
          background:
            "linear-gradient(90deg, #5f0c5e 0%, #5f0c5e 80%, #9d0c0e 100%)",
        }}
      >
        <div className="flex items-center space-x-2 font-medium">
          <span className="text-white font-semibold tracking-wide">
            MEDICAPS UNIVERSITY
          </span>
          <span className="text-white/50">|</span>
          <span className="hidden sm:inline text-white/90">
            Department of Electronics Engineering
          </span>
          <span className="sm:hidden text-white/90">ECE Department</span>
        </div>
        <div className="flex items-center space-x-4 text-white/90">
          <Link
            href="https://t.me/contactcj"
            target="_blank"
            rel="noreferrer"
            className="-mr-2 sm:-mr-4 text-[#f7f1e8]/40 hover:text-[#f7f1e8] transition-colors text-[10px] font-normal tracking-wide"
            style={{ fontFamily: "Fredoka, sans-serif" }}
          >
            Developed by Chetan CJ
          </Link>
        </div>
      </div>

      {!hideMainNavigation && (
        <div className="w-full px-4 sm:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <Image
              src="/medicaps-logo.png"
              alt="Medicaps Faculty of Engineering"
              width={180}
              height={40}
              className="h-9 sm:h-10 w-auto object-contain"
            />
            <div className="hidden sm:block border-l border-border-subtle pl-3">
              <div className="text-xs font-bold text-primary leading-tight tracking-wider uppercase">
                ECE Course Portal
              </div>
              <div className="text-[10px] text-text-secondary font-medium leading-none mt-0.5">
                Medicaps University, Indore
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-6">
            {!user && (
              <Link
                href="/"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/"
                    ? "text-primary font-semibold"
                    : "text-text-secondary"
                }`}
              >
                Home
              </Link>
            )}
            <Link
              href="/courses"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname.startsWith("/courses")
                  ? "text-primary font-semibold"
                  : "text-text-secondary"
              }`}
            >
              Courses Catalog
            </Link>
            {isStudent && (
              <>
                <Link
                  href="/student"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname === "/student"
                      ? "text-primary font-semibold"
                      : "text-text-secondary"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/student/certificates"
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathname.startsWith("/student/certificates")
                      ? "text-primary font-semibold"
                      : "text-text-secondary"
                  }`}
                >
                  My Certificates
                </Link>
              </>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-text-secondary hover:text-primary"
              >
                Admin Portal
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-xs font-semibold text-text-primary">
                    {user.student?.full_name || user.username}
                  </div>
                  <div className="text-[11px] text-text-muted font-mono">
                    {user.student?.enrollment_number || user.role}
                  </div>
                </div>
                <Link href={isStudent ? "/student" : "/admin"}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs font-medium border-border-subtle text-primary hover:bg-primary/5"
                  >
                    {isStudent && <LayoutDashboard className="w-3.5 h-3.5" />}
                    <span>{isStudent ? "Dashboard" : "Admin Panel"}</span>
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="h-8 w-8 p-0 text-text-muted hover:text-primary hover:bg-primary/5"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button size="sm" className="gap-1.5 h-8 text-xs">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Student Login</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
