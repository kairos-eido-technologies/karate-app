import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LayoutGrid, Users, CalendarCheck, IndianRupee, BarChart2, Settings, Shield, Home } from "lucide-react";
import { db } from "@/lib/db/db";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: () => {
    return { user: { id: 1, username: "admin", role: "admin" } };
  },
  component: AuthenticatedLayout,
});

const DESKTOP_NAV = [
  { to: "/apps" as const, label: "Apps", icon: LayoutGrid },
  { to: "/dashboard" as const, label: "Dashboard", icon: Home },
  { to: "/students" as const, label: "Students", icon: Users },
  { to: "/attendance" as const, label: "Attendance", icon: CalendarCheck },
  { to: "/fees" as const, label: "Fees", icon: IndianRupee },
  { to: "/reports" as const, label: "Reports", icon: BarChart2 },
];

const MOBILE_NAV = [
  { to: "/apps" as const, label: "Home", icon: LayoutGrid },
  { to: "/students" as const, label: "Students", icon: Users },
  { to: "/attendance" as const, label: "Attendance", icon: CalendarCheck },
  { to: "/fees" as const, label: "Fees", icon: IndianRupee },
  { to: "/reports" as const, label: "Reports", icon: BarChart2 },
];

function AuthenticatedLayout() {
  const [academyName, setAcademyName] = useState("Dojo Master Academy");

  useEffect(() => {
    const update = () => {
      const s = db.getSettings();
      if (s?.academy_name) setAcademyName(s.academy_name);
    };
    update();
    return db.subscribe(update);
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="h-14 sticky top-0 z-30 flex items-center justify-between px-3 md:px-6 bg-white/95 backdrop-blur-md border-b border-[var(--border)] shadow-2xs"
      >
        <Link to="/apps" className="flex items-center gap-2.5 cursor-pointer group">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center border border-[var(--border)] transition group-hover:scale-105 shadow-2xs"
            style={{ background: "var(--primary)" }}
          >
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-black text-base md:text-lg leading-tight truncate max-w-[180px] sm:max-w-xs" style={{ color: "var(--primary)" }}>
              {academyName}
            </span>
            <span
              className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit"
              style={{ background: "#FEF9C3", color: "#713F12", borderColor: "#FDE047" }}
            >
              KARATE
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {DESKTOP_NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer hover:bg-[var(--muted)]"
              activeProps={{ className: "bg-[var(--primary)] text-white shadow-xs" }}
              style={{ color: "var(--foreground)" }}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Header Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link to="/apps" title="Apps Launcher" className="hidden sm:block">
            <button
              className="h-9 w-9 rounded-xl flex items-center justify-center border cursor-pointer transition active:scale-95 hover:bg-[var(--muted)]"
              style={{ borderColor: "var(--border)" }}
            >
              <LayoutGrid className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </Link>
          <Link to="/settings" title="Settings">
            <button
              className="h-9 w-9 rounded-xl flex items-center justify-center border cursor-pointer transition active:scale-95 hover:bg-[var(--muted)]"
              style={{ borderColor: "var(--border)" }}
            >
              <Settings className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
            </button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative z-10 pb-24 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation (Native App Style) */}
      <nav
        className="fixed bottom-0 left-0 right-0 md:hidden z-30 flex items-center justify-around border-t bg-white/95 backdrop-blur-md shadow-lg"
        style={{
          borderColor: "var(--border)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 0.35rem)",
          paddingTop: "0.35rem",
        }}
      >
        {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex-1 flex flex-col items-center justify-center py-1 gap-0.5 cursor-pointer transition active:scale-90"
            activeProps={{ className: "text-[#8B1A1A] font-bold" }}
            inactiveProps={{ className: "text-stone-500 hover:text-stone-800" }}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] tracking-tight">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
