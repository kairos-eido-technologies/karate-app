import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  BarChart2,
  Calendar,
  IndianRupee,
  Users,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  FileText,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { db } from '@/lib/db/db';
import { inr, fmtDate, fmtMonth } from '@/lib/format';
import { BELT_COLORS } from '@/lib/belt-colors';
import { PageHeader } from '@/components/PageHeader';
import { BeltBadge } from '@/components/BeltBadge';
import { exportHtmlToPdf } from '@/lib/pdf-export';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
});

function ReportsPage() {
  const navigate = useNavigate();
  const [, setTick] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  const settings = db.getSettings();
  const students = db.getStudents(true);
  const beltLevels = db.getBeltLevels();
  const attendance = db.getAttendance();
  const fees = db.getFees(selectedMonth);

  // 1. Attendance Report per student for this month
  const attendanceRows = students.map((s) => {
    const studentAttendance = attendance.filter(
      (a) => a.student_id === s.id && a.date.startsWith(selectedMonth)
    );
    const present = studentAttendance.filter((a) => a.status === 'PRESENT').length;
    const absent = studentAttendance.filter((a) => a.status === 'ABSENT').length;
    const late = studentAttendance.filter((a) => a.status === 'LATE').length;
    const leave = studentAttendance.filter((a) => a.status === 'LEAVE').length;
    const total = studentAttendance.length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    const belt = beltLevels.find((b) => b.id === s.belt_level_id);

    return {
      id: s.id,
      name: s.name,
      beltName: belt?.name || 'White',
      present,
      absent,
      late,
      leave,
      total,
      rate,
    };
  });

  // Export Attendance to PDF
  const handleExportAttendancePdf = () => {
    try {
      const columns = [
        { header: '#', align: 'center' as const },
        { header: 'Student Name', align: 'left' as const },
        { header: 'Belt Level', align: 'left' as const },
        { header: 'Present', align: 'center' as const },
        { header: 'Absent', align: 'center' as const },
        { header: 'Late', align: 'center' as const },
        { header: 'Leave', align: 'center' as const },
        { header: 'Total Sessions', align: 'center' as const },
        { header: 'Attendance %', align: 'right' as const },
      ];

      const rows = attendanceRows.map((r, i) => [
        i + 1,
        r.name,
        r.beltName,
        r.present,
        r.absent,
        r.late,
        r.leave,
        r.total,
        `${r.rate}%`,
      ]);

      const avgRate =
        attendanceRows.length > 0
          ? Math.round(
              attendanceRows.reduce((acc, r) => acc + r.rate, 0) / attendanceRows.length
            )
          : 0;

      exportHtmlToPdf({
        title: 'Monthly Student Attendance Report',
        subtitle: `Session Month: ${fmtMonth(selectedMonth)}`,
        filename: `Attendance_Report_${selectedMonth}`,
        academyName: settings?.academy_name,
        address: settings?.address,
        phone: settings?.phone,
        columns,
        rows,
        summary: [
          { label: 'Total Enrolled', value: `${attendanceRows.length} Students` },
          { label: 'Avg Attendance', value: `${avgRate}%` },
        ],
      });
      toast.success('Generating Attendance PDF...');
    } catch {
      toast.error('Failed to generate Attendance PDF.');
    }
  };

  // 2. Fee Collection Breakdown
  const totalDue = fees.reduce((acc, f) => acc + (f.amount_due || 0), 0) || students.length * 1500;
  const totalPaid = fees.reduce((acc, f) => acc + (f.amount_paid || 0), 0);
  const totalPending = Math.max(0, totalDue - totalPaid);
  const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

  // Export Fee Statements to PDF
  const handleExportFeesPdf = () => {
    try {
      const eligible = students.filter((s) => {
        const enrollMonth = s.enrollment_date ? s.enrollment_date.slice(0, 7) : '1970-01';
        return enrollMonth <= selectedMonth;
      });

      const columns = [
        { header: '#', align: 'center' as const },
        { header: 'Student Name', align: 'left' as const },
        { header: 'Parent WhatsApp', align: 'left' as const },
        { header: 'Monthly Due', align: 'right' as const },
        { header: 'Paid Amount', align: 'right' as const },
        { header: 'Balance Due', align: 'right' as const },
        { header: 'Status', align: 'center' as const },
      ];

      const rows = eligible.map((s, i) => {
        const fee = fees.find((f) => f.student_id === s.id);
        const due = fee?.amount_due || s.monthly_fee || 1500;
        const paid = fee?.amount_paid || 0;
        const bal = due - paid;
        const status = fee?.payment_status || (bal <= 0 ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID');

        return [
          i + 1,
          s.name,
          s.parent_phone,
          inr(due),
          inr(paid),
          inr(Math.max(0, bal)),
          status,
        ];
      });

      exportHtmlToPdf({
        title: 'Monthly Tuition Fee Statement',
        subtitle: `Billing Month: ${fmtMonth(selectedMonth)}`,
        filename: `Fee_Statement_${selectedMonth}`,
        academyName: settings?.academy_name,
        address: settings?.address,
        phone: settings?.phone,
        columns,
        rows,
        summary: [
          { label: 'Total Expected Dues', value: inr(totalDue) },
          { label: 'Total Collected', value: inr(totalPaid) },
          { label: 'Total Outstanding', value: inr(totalPending) },
        ],
      });
      toast.success('Generating Fee Statement PDF...');
    } catch {
      toast.error('Failed to generate Fee Statement PDF.');
    }
  };

  const pieData = [
    { name: 'Collected', value: totalPaid, color: '#16a34a' },
    { name: 'Pending', value: totalPending, color: '#dc2626' },
  ];

  // 3. Belt Level Distribution
  const beltDistribution = beltLevels.map((belt) => {
    const count = students.filter((s) => s.belt_level_id === belt.id).length;
    const color = BELT_COLORS[belt.name]?.text || '#374151';
    return {
      name: belt.name,
      count,
      color,
    };
  });

  // 4. Pending Dues Report
  const pendingDuesList = students
    .map((s) => {
      const studentFees = db.getFees().filter((f) => f.student_id === s.id);
      const unpaidFees = studentFees.filter((f) => (f.amount_due - f.amount_paid) > 0);
      const totalBalance = unpaidFees.reduce((acc, f) => acc + (f.amount_due - f.amount_paid), 0);
      const overdueMonths = unpaidFees.length;
      return {
        student: s,
        overdueMonths: overdueMonths || (fees.find((f) => f.student_id === s.id)?.payment_status !== 'PAID' ? 1 : 0),
        totalBalance: totalBalance || s.monthly_fee || 1500,
      };
    })
    .filter((row) => row.totalBalance > 0)
    .sort((a, b) => b.totalBalance - a.totalBalance);

  // Export Pending Dues to PDF
  const handleExportPendingDuesPdf = () => {
    try {
      const columns = [
        { header: '#', align: 'center' as const },
        { header: 'Student Name', align: 'left' as const },
        { header: 'Parent Contact', align: 'left' as const },
        { header: 'Overdue Months', align: 'center' as const },
        { header: 'Outstanding Due', align: 'right' as const },
      ];

      const rows = pendingDuesList.map((p, i) => [
        i + 1,
        p.student.name,
        p.student.parent_phone,
        `${p.overdueMonths} mo`,
        inr(p.totalBalance),
      ]);

      const totalBalanceAll = pendingDuesList.reduce((acc, p) => acc + p.totalBalance, 0);

      exportHtmlToPdf({
        title: 'Outstanding Fee Dues Roster',
        subtitle: `As of ${new Date().toLocaleDateString('en-IN')}`,
        filename: `Pending_Dues_Roster_${selectedMonth}`,
        academyName: settings?.academy_name,
        address: settings?.address,
        phone: settings?.phone,
        columns,
        rows,
        summary: [
          { label: 'Pending Students', value: `${pendingDuesList.length}` },
          { label: 'Total Overdue Balance', value: inr(totalBalanceAll) },
        ],
      });
      toast.success('Generating Dues PDF...');
    } catch {
      toast.error('Failed to generate Dues PDF.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Reports & Analytics"
        subtitle="Insights on academy attendance, fee collections, and student progress"
        action={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
              className="h-10 px-3 rounded-xl border text-xs font-mono font-medium cursor-pointer"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>
        }
      />

      {/* 2x2 Grid of Report Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Monthly Attendance Report */}
        <div className="bg-white rounded-2xl border p-5 shadow-2xs space-y-4 flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-bold text-sm text-stone-900">Student Attendance Report</h3>
                <span className="text-xs text-stone-400 font-mono">{fmtMonth(selectedMonth)}</span>
              </div>
              <button
                onClick={handleExportAttendancePdf}
                className="h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50 transition active:scale-95"
                style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
              >
                <FileText className="h-3.5 w-3.5 text-rose-700" />
                Export Attendance PDF
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-stone-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-2">Student</th>
                    <th className="py-2">Belt</th>
                    <th className="py-2 text-center">Pres</th>
                    <th className="py-2 text-center">Abs</th>
                    <th className="py-2 text-right">Att %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {attendanceRows.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50">
                      <td className="py-2 font-bold text-stone-900">{r.name}</td>
                      <td className="py-2"><BeltBadge beltName={r.beltName} /></td>
                      <td className="py-2 text-center font-mono text-emerald-600 font-bold">{r.present}</td>
                      <td className="py-2 text-center font-mono text-rose-600">{r.absent}</td>
                      <td className="py-2 text-right font-mono font-bold">
                        <span className={r.rate < 75 ? 'text-red-600 font-black' : 'text-stone-800'}>
                          {r.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="pt-2 text-[10px] text-stone-400 border-t flex justify-between">
            <span>* Red text indicates attendance below 75% threshold</span>
            <span className="font-mono">{attendanceRows.length} students</span>
          </div>
        </div>

        {/* Card 2: Monthly Fee Collection Breakdown */}
        <div className="bg-white rounded-2xl border p-5 shadow-2xs space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <div>
              <h3 className="font-bold text-sm text-stone-900">Fee Collection Overview</h3>
              <span className="text-xs text-stone-400 font-mono">{fmtMonth(selectedMonth)}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportFeesPdf}
                className="h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50 transition active:scale-95"
                style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
              >
                <FileText className="h-3.5 w-3.5 text-rose-700" />
                Export Fees PDF
              </button>
              <span className="hidden sm:inline text-xs font-mono font-black" style={{ color: 'var(--primary)' }}>
                {collectionRate}% Collected
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-48 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => inr(Number(val))}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5DDD0', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                <span className="text-[10px] text-stone-500 font-bold uppercase block">Total Due</span>
                <span className="text-lg font-mono font-black text-stone-900">{inr(totalDue)}</span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[10px] text-emerald-800 font-bold uppercase block">Total Collected</span>
                <span className="text-lg font-mono font-black text-emerald-700">{inr(totalPaid)}</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[10px] text-rose-800 font-bold uppercase block">Total Pending</span>
                <span className="text-lg font-mono font-black text-rose-700">{inr(totalPending)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Belt Level Distribution */}
        <div className="bg-white rounded-2xl border p-5 shadow-2xs space-y-4" style={{ borderColor: 'var(--border)' }}>
          <div className="pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="font-bold text-sm text-stone-900">Belt Level Distribution</h3>
            <span className="text-xs text-stone-400">Total active students by rank</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={beltDistribution} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5DDD0" opacity={0.6} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#6B6560' }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#1A1A1A' }} width={60} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5DDD0', fontSize: '11px' }}
                />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 4: Pending Dues Report */}
        <div className="bg-white rounded-2xl border p-5 shadow-2xs space-y-4 flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
          <div>
            <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div>
                <h3 className="font-bold text-sm text-stone-900">Pending Dues Roster</h3>
                <span className="text-xs text-stone-400 font-mono">Sorted by overdue amount</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPendingDuesPdf}
                  className="h-8 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:bg-stone-50 transition active:scale-95"
                  style={{ borderColor: 'var(--border)', color: 'var(--primary)' }}
                >
                  <FileText className="h-3.5 w-3.5 text-rose-700" />
                  Export Dues PDF
                </button>
                <button
                  onClick={() => navigate({ to: '/fees' })}
                  className="h-8 px-3 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-2xs"
                  style={{ background: '#25D366' }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Reminders
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto mt-3">
              <table className="w-full text-left text-xs">
                <thead className="text-stone-400 uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-2">Student</th>
                    <th className="py-2">Phone</th>
                    <th className="py-2 text-center">Months</th>
                    <th className="py-2 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pendingDuesList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-stone-400">
                        No outstanding dues! All students are paid up.
                      </td>
                    </tr>
                  ) : (
                    pendingDuesList.map(({ student, overdueMonths, totalBalance }) => (
                      <tr key={student.id} className="hover:bg-stone-50">
                        <td className="py-2 font-bold text-stone-900">{student.name}</td>
                        <td className="py-2 font-mono text-stone-500">{student.parent_phone}</td>
                        <td className="py-2 text-center font-mono">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            {overdueMonths} mo
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono font-black text-rose-600">
                          {inr(totalBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="pt-2 text-[10px] text-stone-400 border-t flex justify-between">
            <span>{pendingDuesList.length} students with outstanding fees</span>
            <span className="font-mono font-bold text-stone-700">
              Total: {inr(pendingDuesList.reduce((acc, p) => acc + p.totalBalance, 0))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
