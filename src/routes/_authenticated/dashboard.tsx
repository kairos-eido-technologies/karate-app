import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Users,
  CalendarCheck,
  UserX,
  IndianRupee,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  CreditCard,
  PlusCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays } from 'date-fns';
import { db } from '@/lib/db/db';
import { inr, fmtDate } from '@/lib/format';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { BeltBadge } from '@/components/BeltBadge';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const [, setTick] = useState(0);

  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const students = db.getStudents(true);
  const totalStudents = students.length;

  const todayAttendance = db.getAttendance(todayStr);
  const presentToday = todayAttendance.filter((a) => a.status === 'PRESENT').length;
  const absentToday = todayAttendance.filter((a) => a.status === 'ABSENT').length;
  const lateToday = todayAttendance.filter((a) => a.status === 'LATE').length;
  const leaveToday = todayAttendance.filter((a) => a.status === 'LEAVE').length;

  const fees = db.getFees(currentMonthStr);
  const totalDueMonth = fees.reduce((acc, f) => acc + (f.amount_due || 0), 0);
  const totalPaidMonth = fees.reduce((acc, f) => acc + (f.amount_paid || 0), 0);
  const pendingCountMonth = fees.filter((f) => f.payment_status === 'UNPAID' || f.payment_status === 'PARTIAL').length;
  const collectionRate = totalDueMonth > 0 ? Math.round((totalPaidMonth / totalDueMonth) * 100) : 0;

  // Chart data: Last 7 days attendance %
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const dStr = format(d, 'yyyy-MM-dd');
    const dayAttendance = db.getAttendance(dStr);
    const dayPresent = dayAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const rate = totalStudents > 0 ? Math.round((dayPresent / totalStudents) * 100) : 0;
    return {
      day: format(d, 'EEE (dd)'),
      rate,
      present: dayPresent,
    };
  });

  // Recent activity: fees and attendance combined
  const recentFees = [...db.getFees()]
    .filter((f) => f.payment_date)
    .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''))
    .slice(0, 4);

  const kpis = [
    {
      label: 'Total Students',
      value: totalStudents,
      icon: Users,
      color: 'var(--primary)',
      sub: 'Active enrolled',
    },
    {
      label: 'Present Today',
      value: presentToday,
      icon: CalendarCheck,
      color: '#16a34a',
      sub: `${totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0}% attendance`,
    },
    {
      label: 'Absent Today',
      value: absentToday,
      icon: UserX,
      color: '#dc2626',
      sub: `${lateToday} marked late`,
    },
    {
      label: 'Fees Collected',
      value: inr(totalPaidMonth),
      icon: IndianRupee,
      color: '#16a34a',
      sub: `${collectionRate}% of monthly dues`,
    },
    {
      label: 'Pending Dues',
      value: pendingCountMonth,
      icon: AlertCircle,
      color: '#d97706',
      sub: 'Students pending',
    },
  ];

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in">
      <PageHeader
        title="Academy Dashboard"
        subtitle="Live attendance & fee overview"
        action={
          <div className="flex items-center gap-2">
            <Link to="/attendance">
              <button
                className="h-10 px-4 rounded-xl font-bold text-xs text-white flex items-center gap-2 cursor-pointer transition active:scale-95 shadow-xs"
                style={{ background: 'var(--primary)' }}
              >
                <CalendarCheck className="h-4 w-4" />
                Mark Attendance
              </button>
            </Link>
            <Link to="/fees">
              <button
                className="h-10 px-4 rounded-xl font-bold text-xs border flex items-center gap-2 cursor-pointer transition active:scale-95 bg-white hover:bg-stone-50"
                style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
              >
                <CreditCard className="h-4 w-4" />
                Collect Fee
              </button>
            </Link>
          </div>
        }
      />

      {/* KPI Row (5 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="rounded-xl p-4 bg-white border shadow-2xs transition hover:shadow-xs border-l-4"
              style={{ borderColor: 'var(--border)', borderLeftColor: kpi.color }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>
                  {kpi.label}
                </span>
                <Icon className="h-4 w-4" style={{ color: kpi.color }} />
              </div>
              <div className="mt-2 text-2xl font-mono font-black" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              {kpi.sub && (
                <div className="text-[10px] mt-0.5 font-mono" style={{ color: 'var(--muted-foreground)' }}>
                  {kpi.sub}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Row 2: 3-column Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Today's Attendance Breakdown */}
        <div className="rounded-xl p-5 bg-white border shadow-2xs" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Today's Session
            </h3>
            <span className="text-xs font-mono text-stone-400">{todayStr}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50">
              <span className="text-[11px] font-bold text-emerald-800 uppercase block">Present</span>
              <span className="text-2xl font-mono font-black text-emerald-700">{presentToday}</span>
            </div>
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50">
              <span className="text-[11px] font-bold text-rose-800 uppercase block">Absent</span>
              <span className="text-2xl font-mono font-black text-rose-700">{absentToday}</span>
            </div>
            <div className="p-3 rounded-lg border border-amber-200 bg-amber-50">
              <span className="text-[11px] font-bold text-amber-800 uppercase block">Late</span>
              <span className="text-2xl font-mono font-black text-amber-700">{lateToday}</span>
            </div>
            <div className="p-3 rounded-lg border border-stone-200 bg-stone-50">
              <span className="text-[11px] font-bold text-stone-700 uppercase block">Leave</span>
              <span className="text-2xl font-mono font-black text-stone-700">{leaveToday}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs" style={{ borderColor: 'var(--border)' }}>
            <span className="text-stone-500 font-medium">Unmarked students:</span>
            <span className="font-mono font-bold text-stone-800">
              {Math.max(0, totalStudents - (presentToday + absentToday + lateToday + leaveToday))}
            </span>
          </div>
        </div>

        {/* Monthly Fee Progress */}
        <div className="rounded-xl p-5 bg-white border shadow-2xs" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
              Monthly Collection
            </h3>
            <span className="text-xs font-mono text-stone-400">{currentMonthStr}</span>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span className="text-stone-500">Collected vs Target</span>
                <span className="font-mono font-bold" style={{ color: 'var(--primary)' }}>
                  {collectionRate}%
                </span>
              </div>
              <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden border border-stone-200">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, collectionRate)}%`, background: 'var(--primary)' }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Collected</span>
                <span className="text-sm font-mono font-black text-emerald-600">{inr(totalPaidMonth)}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200">
                <span className="text-[10px] font-bold text-stone-500 uppercase block">Pending</span>
                <span className="text-sm font-mono font-black text-amber-600">
                  {inr(Math.max(0, totalDueMonth - totalPaidMonth))}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
            <Link to="/fees" className="text-xs font-bold inline-flex items-center gap-1 hover:underline" style={{ color: 'var(--primary)' }}>
              View Fee Ledger <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent Payment Feed */}
        <div className="rounded-xl p-5 bg-white border shadow-2xs flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm" style={{ color: 'var(--foreground)' }}>
                Recent Payments
              </h3>
              <CreditCard className="h-4 w-4 text-stone-400" />
            </div>
            {recentFees.length === 0 ? (
              <p className="text-xs text-stone-400 text-center py-6">No payments recorded yet</p>
            ) : (
              <div className="space-y-3">
                {recentFees.map((rf) => {
                  const student = db.getStudent(rf.student_id);
                  return (
                    <div key={rf.id} className="flex items-center justify-between text-xs border-b pb-2 border-stone-100 last:border-none">
                      <div>
                        <span className="font-bold text-stone-900 block">{student?.name || 'Student'}</span>
                        <span className="font-mono text-[10px] text-stone-400">
                          {rf.payment_date ? fmtDate(rf.payment_date) : ''} · {rf.payment_mode}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-black text-emerald-600">{inr(rf.amount_paid)}</span>
                        <span className="block text-[10px] font-mono text-stone-400">{rf.receipt_number}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <Link to="/fees" className="text-xs font-bold inline-flex items-center justify-end gap-1 hover:underline pt-3 border-t border-stone-100" style={{ color: '#25D366' }}>
            Fee Reminders <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 3: 7-Day Attendance Chart */}
      <div className="rounded-xl p-6 bg-white border shadow-2xs" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-black" style={{ color: 'var(--primary)' }}>
              Last 7 Days Attendance Trend (%)
            </h3>
            <p className="text-xs text-stone-500 font-medium mt-0.5">Overall daily student presence</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-xs" style={{ background: 'var(--primary)' }} />
            <span className="text-xs font-semibold text-stone-600">Attendance %</span>
          </div>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5DDD0" opacity={0.6} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#6B6560' }} axisLine={{ stroke: '#E5DDD0' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6B6560' }} axisLine={{ stroke: '#E5DDD0' }} unit="%" />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-3 rounded-xl shadow-lg border text-xs" style={{ borderColor: 'var(--border)' }}>
                        <p className="font-bold text-stone-900 mb-1">{data.day}</p>
                        <p className="font-mono text-emerald-600 font-bold">Attendance: {data.rate}%</p>
                        <p className="font-mono text-stone-500">Present students: {data.present}</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="rate" fill="var(--primary)" radius={[6, 6, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
