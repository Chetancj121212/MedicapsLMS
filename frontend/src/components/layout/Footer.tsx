import React from "react";
import Link from "next/link";
import { Mail, MapPin, Phone, ShieldCheck, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-btn-blue-dark text-slate-300 border-t border-btn-blue/40 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-xs">
          {/* Col 1: Portal Branding */}
          <div className="space-y-3">
            <div className="flex flex-col space-y-2">
              <img
                src="/medicaps-logo-white.png"
                alt="Medicaps Faculty of Engineering"
                className="h-8 w-auto object-contain object-left"
              />
              <div className="text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
                ECE Department Course Portal
              </div>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
              Department of Electronics Engineering. Structured academic pedagogy and verified digital certification.
            </p>
          </div>

          {/* Col 2: Academic Portal */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Academic Portal
            </h4>
            <ul className="space-y-1.5 text-[12px] text-slate-300">
              <li>
                <Link href="/" className="hover:text-white transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/courses" className="hover:text-white transition-colors">
                  ECE Online Courses
                </Link>
              </li>
              <li>
                <Link href="/verify" className="hover:text-white transition-colors flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#5a7ab5]" />
                  <span>Certificate Verification</span>
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors">
                  Portal Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Department of Electronics Engineering */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Department of Electronics Engineering
            </h4>
            <ul className="space-y-1.5 text-[12px] text-slate-300">
              <li>Embedded Systems & IoT</li>
              <li>VLSI & Microelectronics</li>
              <li>Digital Signal Processing</li>
              <li>Wireless Communications</li>
            </ul>
          </div>

          {/* Col 4: University Campus Contact */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Campus Contact
            </h4>
            <ul className="space-y-1.5 text-[11px] text-slate-300">
              <li className="flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#5a7ab5] shrink-0 mt-0.5" />
                <span>AB Road, Pigdamber, Rau, Indore, MP 453331</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#5a7ab5] shrink-0" />
                <span>ece.office@medicaps.ac.in</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#5a7ab5] shrink-0" />
                <span>+91 731 4259500</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 mt-6 pt-4 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 gap-2">
          <div>
            &copy; {new Date().getFullYear()} Medicaps University. Department of Electronics Engineering.
          </div>
          <div className="flex space-x-4">
            <a
              href="https://www.medicaps.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <span>medicaps.ac.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
