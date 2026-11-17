import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  LayoutGrid,
  Users,
  CalendarCheck,
  IndianRupee,
  BarChart3,
  Settings,
  Search,
} from "lucide-react";
import { db } from "@/lib/db/db";

export const Route = createFileRoute("/_authenticated/apps")({
  component: AppsPage,
});

interface AppItem {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  bgClass: string;
  borderClass: string;
  iconClass: string;
}

function AppsPage() {
  const [search, setSearch] = useState("");
  const settings = db.getSettings();
  const academyName = settings?.academy_name || "Dojo Master Academy";

  const apps: AppItem[] = [
    {
      id: "dashboard",
      title: "Dashboard",
      description: "Overview KPIs, daily summary & attendance charts",
      to: "/dashboard",
      icon: LayoutGrid,
      bgClass: "bg-sky-50 hover:bg-sky-100/80",
      borderClass: "border-sky-200",
      iconClass: "text-sky-600",
    },
    {
      id: "students",
      title: "Students",
      description: "Student roster, belt ranks & student profiles",
      to: "/students",
      icon: Users,
      bgClass: "bg-rose-50 hover:bg-rose-100/80",
      borderClass: "border-rose-200",
      iconClass: "text-rose-600",
    },
    {
      id: "attendance",
      title: "Attendance",
      description: "Mark daily student attendance & session tracking",
      to: "/attendance",
      icon: CalendarCheck,
      bgClass: "bg-emerald-50 hover:bg-emerald-100/80",
      borderClass: "border-emerald-200",
      iconClass: "text-emerald-600",
    },
    {
      id: "fees",
      title: "Fees Ledger",
      description: "Track monthly fees, collect payments & send reminders",
      to: "/fees",
      icon: IndianRupee,
      bgClass: "bg-amber-50 hover:bg-amber-100/80",
      borderClass: "border-amber-200",
      iconClass: "text-amber-600",
    },
    {
      id: "reports",
      title: "Reports",
      description: "Monthly attendance, collection breakdown & exports",
      to: "/reports",
      icon: BarChart3,
      bgClass: "bg-purple-50 hover:bg-purple-100/80",
      borderClass: "border-purple-200",
      iconClass: "text-purple-600",
    },
    {
      id: "settings",
      title: "Settings",
      description: "Academy name, fee configuration & system settings",
      to: "/settings",
      icon: Settings,
      bgClass: "bg-slate-50 hover:bg-slate-100/80",
      borderClass: "border-slate-200",
      iconClass: "text-slate-600",
    },
  ];

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter(
      (app) =>
        app.title.toLowerCase().includes(q) ||
        app.description.toLowerCase().includes(q) ||
        app.id.toLowerCase().includes(q)
    );
  }, [search, apps]);

  return (
    <div className="min-h-full flex flex-col items-center justify-center py-12 px-4 md:px-8 relative">
      {/* Background Mild Karate Pose Watermark */}
      <div
        className="pointer-events-none select-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 500 500"
          className="w-[85vw] max-w-[420px] h-auto text-[#8B1A1A] opacity-[0.045] transition-all"
          fill="currentColor"
        >
          {/* Zen Enso Martial Arts Ring */}
          <circle
            cx="250"
            cy="250"
            r="210"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeDasharray="14 18"
            strokeLinecap="round"
            opacity="0.6"
          />
          <circle
            cx="250"
            cy="250"
            r="165"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.4"
          />
          {/* Karate Master Martial Arts Pose Silhouette */}
          <circle cx="215" cy="115" r="28" />
          <path d="M190 112 Q160 118 140 135 Q158 130 188 122 Z" />
          <path d="M190 118 Q155 132 135 155 Q152 142 188 126 Z" />
          <path d="M192 145 C175 160 160 185 150 220 C180 235 220 235 250 220 C245 185 230 160 215 145 Z" />
          <path d="M242 165 C275 165 330 162 375 158 C382 157 388 163 388 170 C388 177 380 182 372 182 C325 184 275 190 248 198 Z" />
          <circle cx="382" cy="170" r="14" />
          <path d="M165 175 C145 190 135 210 130 235 C136 242 148 244 156 238 C162 222 172 205 185 195 Z" />
          <path d="M175 228 H242 V244 H175 Z" />
          <path d="M205 244 C200 270 195 300 180 325 C186 325 194 320 198 310 C208 290 212 268 214 244 Z" />
          <path d="M216 244 C218 268 224 292 235 315 C240 315 246 310 244 300 C236 280 228 260 224 244 Z" />
          <path d="M232 242 C248 270 280 315 315 350 C322 358 322 372 315 388 C308 402 300 425 295 448 H255 C260 425 268 395 260 380 C242 348 218 310 205 285 Z" />
          <path d="M250 445 C275 445 320 445 335 450 C338 454 335 460 325 460 H245 C242 455 245 448 250 445 Z" />
          <path d="M185 242 C168 280 138 340 105 395 C98 408 85 428 70 445 C65 449 68 455 75 455 H115 C135 432 152 405 172 370 C202 318 220 275 228 242 Z" />
          <path d="M65 450 C80 450 115 450 120 455 C122 460 115 462 105 462 H60 C58 458 60 452 65 450 Z" />
        </svg>
      </div>

      <div className="w-full max-w-4xl z-10 flex flex-col items-center">
        {/* Top Search Bar */}
        <div className="w-full max-w-md mb-12 relative">
          <div className="relative flex items-center">
            <Search className="absolute left-4 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search apps or tools..."
              className="w-full h-11 pl-11 pr-4 bg-white/95 rounded-2xl border border-[var(--border)] text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all placeholder:text-[var(--muted-foreground)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3.5 text-xs font-semibold text-[var(--muted-foreground)] hover:text-foreground cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Apps Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-y-8 gap-x-6 w-full justify-items-center">
          {filteredApps.map((app) => {
            const Icon = app.icon;
            return (
              <Link
                key={app.id}
                to={app.to}
                className="group flex flex-col items-center cursor-pointer transition active:scale-95 focus:outline-none"
              >
                <div
                  className={`w-20 h-20 rounded-2xl border ${app.borderClass} ${app.bgClass} shadow-xs flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:shadow-md`}
                >
                  <Icon className={`w-8 h-8 ${app.iconClass} transition-transform duration-200 group-hover:scale-110`} />
                </div>
                <span className="mt-3 text-sm font-semibold text-center text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors">
                  {app.title}
                </span>
              </Link>
            );
          })}
        </div>

        {filteredApps.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm font-semibold text-[var(--muted-foreground)]">
              No apps matching &ldquo;{search}&rdquo;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
