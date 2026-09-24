import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: `${siteConfig.universityName} ${siteConfig.shortDepartmentName} Course Portal`,
  description: `Official Learning Management System of the ${siteConfig.departmentName}, ${siteConfig.universityName}, Indore.`,
  keywords: [
    "Medicaps University",
    "ECE",
    "LMS",
    "Embedded Systems",
    "Engineering Courses",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-[#F7F8FA] text-text-primary antialiased">
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
