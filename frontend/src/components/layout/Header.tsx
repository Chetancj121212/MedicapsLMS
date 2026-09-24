"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { User as UserIcon, LogOut, Menu, X, Shield, Award, LayoutDashboard } from "lucide-react";

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStudent = user?.role === "STUDENT";
  const isAdmin = user && user.role !== "STUDENT";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-subtle bg-white/95 backdrop-blur-xs">
      {/* Top Academic Sub-bar */}
      <div
        className="text-white/90 text-xs py-1.5 px-4 sm:px-8 flex justify-between items-center shadow-xs"
        style={{
          background: "linear-gradient(90deg, #5f0c5e 0%, #5f0c5e 80%, #9d0c0e 100%)",
        }}
      >
        <div className="flex items-center space-x-2 font-medium">
          <span className="text-white font-semibold tracking-wide">MEDICAPS UNIVERSITY</span>
          <span className="text-white/50">|</span>
          <span className="hidden sm:inline text-white/90">Department of Electronics Engineering</span>
          <span className="sm:hidden text-white/90">ECE Department</span>
        </div>
        <div className="flex items-center space-x-4 text-white/90">
          <Link href="/verify" className="hover:text-white transition-colors flex items-center gap-1.5 text-[11px] font-medium">
            <Award className="w-3.5 h-3.5 text-amber-300" />
            <span>Verify Certificate</span>
          </Link>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="w-full px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <Link href="/" className="flex items-center space-x-3 group">
          <img
            src="/medicaps-logo.png"
            alt="Medicaps Faculty of Engineering"
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

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              pathname === "/" ? "text-primary font-semibold" : "text-text-secondary"
            }`}
          >
            Home
          </Link>
          <Link
            href="/courses"
            className={`text-sm font-medium transition-colors hover:text-primary ${
              pathname.startsWith("/courses") ? "text-primary font-semibold" : "text-text-secondary"
            }`}
          >
            Courses Catalog
          </Link>

          {isStudent && (
            <>
              <Link
                href="/student"
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  pathname === "/student" ? "text-primary font-semibold" : "text-text-secondary"
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
              className={`text-sm font-medium transition-colors hover:text-primary flex items-center gap-1.5 ${
                pathname.startsWith("/admin") ? "text-primary font-semibold" : "text-text-secondary"
              }`}
            >
              <Shield className="w-4 h-4 text-primary" />
              <span>Admin Portal</span>
            </Link>
          )}
        </nav>

        {/* Right Action / Auth Button */}
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

              {isStudent ? (
                <Link href="/student">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-medium border-border-subtle text-primary hover:bg-primary/5">
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </Button>
                </Link>
              ) : (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs font-medium border-border-subtle text-primary hover:bg-primary/5">
                    <Shield className="w-3.5 h-3.5" />
                    <span>Admin Panel</span>
                  </Button>
                </Link>
              )}

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
                <span>Student / Faculty Login</span>
              </Button>
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-text-secondary hover:bg-[#F0F3F8]"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border-subtle bg-white px-4 pt-3 pb-5 space-y-2">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-text-primary hover:text-primary"
          >
            Home
          </Link>
          <Link
            href="/courses"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-text-primary hover:text-primary"
          >
            Courses Catalog
          </Link>

          {isStudent && (
            <>
              <Link
                href="/student"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-text-primary hover:text-primary"
              >
                Student Dashboard
              </Link>
              <Link
                href="/student/certificates"
                onClick={() => setMobileMenuOpen(false)}
                className="block py-2 text-sm font-medium text-text-primary hover:text-primary"
              >
                My Certificates
              </Link>
            </>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-medium text-primary"
            >
              Admin Portal
            </Link>
          )}

          <div className="pt-3 border-t border-border-subtle">
            {user ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-text-primary">
                  {user.student?.full_name || user.username} ({user.student?.enrollment_number || user.role})
                </div>
                <Button variant="outline" size="sm" onClick={logout} className="w-full text-primary border-border-subtle">
                  <LogOut className="w-4 h-4 mr-2" />
                  Log Out
                </Button>
              </div>
            ) : (
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                <Button size="sm" className="w-full">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
