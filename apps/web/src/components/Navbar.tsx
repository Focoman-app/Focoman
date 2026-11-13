"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FocomanLogo } from "@/components/FocomanLogo";
import { subscribeToAuthState, signOutUser } from "@/lib/firebaseAuth";
import { User } from "firebase/auth";
import { getLocalDefaultWorkspace, subscribeToDefaultWorkspaceChanges } from "@/lib/workspaceDefaults";

function UserDropdownMenu({ user }: { user: User }) {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultStudio, setDefaultStudio] = useState<string | null>(null);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      const { studioId } = getLocalDefaultWorkspace(user.uid);
      setDefaultStudio(studioId);

      const unsub = subscribeToDefaultWorkspaceChanges(user.uid, (newDefault) => {
        setDefaultStudio(newDefault);
      });
      return () => unsub();
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOutUser();
    router.push("/");
  };

  const firstWord = (() => {
    const raw = user.displayName || user.email || "Account";
    const clean = raw.trim();
    if (clean.includes(" ")) {
      return clean.split(" ")[0];
    }
    if (clean.includes("@")) {
      const handle = clean.split("@")[0];
      return handle.split(".")[0];
    }
    return clean;
  })();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#0EA5E9] text-white font-bold text-xs border border-[#0369A1] shadow-[0_2px_0_#0369A1] hover:bg-[#0284C7] active:translate-y-[1.5px] active:shadow-none focus:outline-none transition max-w-[140px]"
        title={user.email || user.displayName || "Account"}
      >
        <span className="truncate">{firstWord}</span>
        <span className="text-[9px] opacity-80">▼</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border border-[#D8D2C4] bg-[#FFFFFF] p-1.5 shadow-[0_4px_16px_rgba(40,30,20,0.12)] z-50">
          <div className="px-3 py-2 border-b border-[#E6E0D4] mb-1">
            <p className="text-xs font-bold text-[#1C1917] truncate">{user.displayName || "Studio Member"}</p>
            <p className="text-[10px] text-[#8C857B] truncate">{user.email}</p>
          </div>
          
          {defaultStudio && (
            <Link
              href={`/${defaultStudio}/dashboard`}
              onClick={() => setIsOpen(false)}
              className="block px-3 py-1.5 text-xs font-bold text-[#0EA5E9] hover:bg-[#FAF7F2] rounded transition"
            >
              Studio Dashboard
            </Link>
          )}
          <Link
            href="/workspaces"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-1.5 text-xs font-medium text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917] rounded transition"
          >
            My Workspaces
          </Link>
          <Link
            href="/account-settings"
            onClick={() => setIsOpen(false)}
            className="block px-3 py-1.5 text-xs font-medium text-[#57534E] hover:bg-[#FAF7F2] hover:text-[#1C1917] rounded transition"
          >
            Account Settings
          </Link>
          <button
            onClick={handleSignOut}
            className="w-full text-left block px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded transition"
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const navLinks = [
    { label: "Home", href: "/#home" },
    { label: "Modules", href: "/#modules" },
    { label: "How It Works", href: "/#how-it-works" },
    { label: "Pricing", href: "/#pricing" },
    { label: "FAQ", href: "/#faq" },
  ];

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[#D8D2C4] bg-[#FAF7F2]/95 backdrop-blur-xs shadow-[0_1px_3px_rgba(40,30,20,0.06)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 lg:px-8">
        {/* Left Side: Hamburger (Mobile) + Logo */}
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {/* Mobile Nav Toggle - Left Corner */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden rounded-md border border-[#D8D2C4] bg-[#FFFFFF] p-1.5 text-[#57534E] shadow-[0_1.5px_0_#C4BCAB] hover:bg-[#FAF7F2] active:translate-y-[1px] active:shadow-none focus:outline-none"
            aria-label="Toggle Menu"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              )}
            </svg>
          </button>

          <Link href="/" className="flex items-center shrink-0">
            <FocomanLogo className="h-7 sm:h-9 md:h-11 w-auto" showStudiosSuffix={true} />
          </Link>
        </div>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex items-center gap-3">
          <nav className="flex items-center gap-1 rounded-md border border-[#D8D2C4] bg-[#ECE6DE] p-1 text-xs font-bold shadow-inner">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded px-3.5 py-1.5 font-bold transition-all ${
                    isActive
                      ? "bg-[#1C1917] text-white shadow-[0_2px_0_#000000]"
                      : "text-[#57534E] hover:text-[#1C1917] hover:bg-[#FAF7F2]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Side Controls (Sign In / User) - Unified for all screens */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {user ? (
            <UserDropdownMenu user={user} />
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center rounded-md bg-[#F97316] text-white px-4 py-1.5 text-xs font-bold border border-[#C2410C] shadow-[0_2px_0_#9A3412] hover:bg-[#EA580C] active:translate-y-[2px] active:shadow-none transition-all shrink-0"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-[#D8D2C4] bg-[#FAF7F2] px-4 py-4 shadow-lg absolute w-full left-0">
          <nav className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`rounded-md px-4 py-2.5 text-sm font-bold transition ${
                    isActive
                      ? "bg-[#F97316] text-white border border-[#C2410C] shadow-[0_2px_0_#9A3412]"
                      : "bg-white text-[#57534E] border border-[#D8D2C4] hover:bg-[#FAF7F2] hover:text-[#1C1917]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}

