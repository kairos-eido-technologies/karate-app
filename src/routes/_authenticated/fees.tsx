import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  IndianRupee,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  CreditCard,
  MessageSquare,
  FileText,
  Calendar,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { db } from '@/lib/db/db';
import { inr, fmtDate, fmtMonth } from '@/lib/format';
import { openWhatsApp, buildReminderMessage, buildReceiptMessage } from '@/lib/whatsapp';
import { shareReceiptToWhatsApp } from '@/lib/receipt-image';
import { PageHeader } from '@/components/PageHeader';
import { BeltBadge } from '@/components/BeltBadge';
import { StatusBadge, FeeStatus } from '@/components/StatusBadge';
import { FeeReceiptModal } from '@/components/FeeReceiptModal';
import { toast } from 'sonner';
import type { Student, FeeRecord } from '@/lib/db/types';

export const Route = createFileRoute('/_authenticated/fees')({
  component: FeesPage,
});

function FeesPage() {
  const [, setTick] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [activeTab, setActiveTab] = useState<'status' | 'transactions'>('status');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID' | 'PARTIAL' | 'OVERDUE'>('ALL');
  const [search, setSearch] = useState('');

  // Modals state
  const [payingStudent, setPayingStudent] = useState<{ student: Student; fee?: FeeRecord } | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<{ fee: FeeRecord; student: Student } | null>(null);

  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  const students = db.getStudents(true);
  const beltLevels = db.getBeltLevels();
  const settings = db.getSettings();
  const allFees = db.getFees();

  // Fees for selected month
  const monthFees = allFees.filter((f) => f.month === selectedMonth);

  // Month navigation
  const monthDate = new Date(`${selectedMonth}-01`);
  const handlePrevMonth = () => {
    setSelectedMonth(format(subMonths(monthDate, 1), 'yyyy-MM'));
  };
  const handleNextMonth = () => {
    setSelectedMonth(format(addMonths(monthDate, 1), 'yyyy-MM'));
  };

  // Filter active students: only show dues from the student's enrollment month onwards
  const eligibleStudents = students.filter((student) => {
    const enrollMonth = student.enrollment_date ? student.enrollment_date.slice(0, 7) : '1970-01';
    return enrollMonth <= selectedMonth;
  });

  // Merge eligible students with their fee record for this month
  const studentFeeRows = eligibleStudents.map((student) => {
    let fee = monthFees.find((f) => f.student_id === student.id);
    if (!fee) {
      fee = {
        id: `virtual-${student.id}`,
        student_id: student.id,
        month: selectedMonth,
        amount_due: student.monthly_fee || 1500,
        amount_paid: 0,
        payment_status: 'UNPAID',
      };
    }
    const balance = (fee.amount_due || student.monthly_fee || 1500) - (fee.amount_paid || 0);

    // Overdue calculation (if month is past and balance > 0)
    const isPastMonth = selectedMonth < new Date().toISOString().slice(0, 7);
    const computedStatus: FeeStatus =
      fee.payment_status === 'PAID'
        ? 'PAID'
        : isPastMonth && balance > 0
        ? 'OVERDUE'
        : fee.amount_paid > 0
        ? 'PARTIAL'
        : 'UNPAID';

    return {
      student,
      fee: { ...fee, balance_due: balance },
      effectiveStatus: computedStatus,
      balance,
    };
  });

  // KPI calculations
  const totalDuesThisMonth = studentFeeRows.reduce((acc, r) => acc + (r.fee.amount_due || 0), 0);
  const totalCollectedThisMonth = studentFeeRows.reduce((acc, r) => acc + (r.fee.amount_paid || 0), 0);
  const pendingCount = studentFeeRows.filter((r) => r.effectiveStatus !== 'PAID').length;
  const fullyPaidCount = studentFeeRows.filter((r) => r.effectiveStatus === 'PAID').length;

  // Filter rows
  const filteredRows = studentFeeRows.filter((row) => {
    const q = search.toLowerCase();
    const matchesSearch = row.student.name.toLowerCase().includes(q) || row.student.parent_phone.includes(q);
    if (!matchesSearch) return false;
    if (statusFilter === 'ALL') return true;
    return row.effectiveStatus === statusFilter;
  });

  // Transaction history (all fees where amount_paid > 0)
  const transactionHistory = [...allFees]
    .filter((f) => (f.amount_paid || 0) > 0 && f.payment_date)
    .sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));

  // WhatsApp Reminder handler
  const handleSendReminder = (s: Student, balance: number) => {
    const msg = buildReminderMessage({
      academyName: settings?.academy_name || 'Dojo Master Academy',
      parentName: s.parent_name,
      studentName: s.name,
      amount: balance,
      month: fmtMonth(selectedMonth),
      phone: settings?.phone || '',
    });
    openWhatsApp(s.parent_phone, msg);
    toast.info('WhatsApp opened. Confirm send in WhatsApp.');
    db.push([
      {
        type: 'LOG_WHATSAPP',
        payload: {
          id: crypto.randomUUID(),
          student_id: s.id,
          phone: s.parent_phone,
          message_type: 'REMINDER',
          message: msg,
          sent_at: new Date().toISOString(),
          status: 'SENT',
        },
      },
    ]);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Fee Management & Ledger"
        subtitle="Track monthly student tuition fees and issue instant digital receipts"
      />

      {/* KPI Summary (4 cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl p-4 bg-white border shadow-2xs border-l-4" style={{ borderColor: 'var(--border)', borderLeftColor: 'var(--primary)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Total Monthly Dues</span>
          <div className="mt-2 text-2xl font-mono font-black" style={{ color: 'var(--primary)' }}>{inr(totalDuesThisMonth)}</div>
          <span className="text-[10px] font-mono text-stone-400">Target for {fmtMonth(selectedMonth)}</span>
        </div>

        <div className="rounded-xl p-4 bg-white border shadow-2xs border-l-4" style={{ borderColor: 'var(--border)', borderLeftColor: '#16a34a' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Total Collected</span>
          <div className="mt-2 text-2xl font-mono font-black text-emerald-600">{inr(totalCollectedThisMonth)}</div>
          <span className="text-[10px] font-mono text-stone-400">
            {totalDuesThisMonth > 0 ? Math.round((totalCollectedThisMonth / totalDuesThisMonth) * 100) : 0}% collected
          </span>
        </div>

        <div className="rounded-xl p-4 bg-white border shadow-2xs border-l-4" style={{ borderColor: 'var(--border)', borderLeftColor: '#d97706' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Pending / Overdue</span>
          <div className="mt-2 text-2xl font-mono font-black text-amber-600">{pendingCount}</div>
          <span className="text-[10px] font-mono text-stone-400">Students with balance due</span>
        </div>

        <div className="rounded-xl p-4 bg-white border shadow-2xs border-l-4" style={{ borderColor: 'var(--border)', borderLeftColor: '#16a34a' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)' }}>Students Fully Paid</span>
          <div className="mt-2 text-2xl font-mono font-black text-emerald-600">{fullyPaidCount}</div>
          <span className="text-[10px] font-mono text-stone-400">Out of {students.length} students</span>
        </div>
      </div>

      {/* Tabs & Month Selector Bar */}
      <div className="bg-white rounded-2xl border p-4 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
        {/* Left Tabs */}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'status'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Student Fee Status
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            Transaction History ({transactionHistory.length})
          </button>
        </div>

        {/* Right: Month Selector Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevMonth}
            className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-stone-50 cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
          >
            <ChevronLeft className="h-4 w-4 text-stone-600" />
          </button>
          <span className="text-sm font-black font-mono px-3 text-stone-800">
            {fmtMonth(selectedMonth)}
          </span>
          <button
            onClick={handleNextMonth}
            className="h-9 w-9 rounded-xl border flex items-center justify-center hover:bg-stone-50 cursor-pointer"
            style={{ borderColor: 'var(--border)' }}
          >
            <ChevronRight className="h-4 w-4 text-stone-600" />
          </button>
        </div>
      </div>

      {activeTab === 'status' ? (
        <div className="space-y-4">
          {/* Filter Pills & Search */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'ALL', label: `All (${studentFeeRows.length})` },
                { key: 'PAID', label: 'Paid ✓' },
                { key: 'UNPAID', label: 'Unpaid ✗' },
                { key: 'PARTIAL', label: 'Partial' },
                { key: 'OVERDUE', label: 'Overdue 🔴' },
              ].map(({ key, label }) => {
                const isSelected = statusFilter === key;
                return (
                  <button
                    key={key}
                    onClick={() => setStatusFilter(key as any)}
                    className={`h-8 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      isSelected
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Search student or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-9 pr-3 rounded-xl border text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>
          </div>

          {/* Desktop Table (hidden on mobile) */}
          <div className="hidden md:block bg-white rounded-2xl border shadow-2xs overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b text-stone-500 uppercase tracking-wider font-bold" style={{ borderColor: 'var(--border)' }}>
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Belt</th>
                  <th className="py-3 px-4">Monthly Fee</th>
                  <th className="py-3 px-4">Month</th>
                  <th className="py-3 px-4">Paid</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Payment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-stone-400">
                      No student records match filter
                    </td>
                  </tr>
                ) : (
                  filteredRows.map(({ student, fee, effectiveStatus, balance }) => {
                    const belt = beltLevels.find((b) => b.id === student.belt_level_id);
                    return (
                      <tr key={student.id} className="hover:bg-stone-50/60 transition">
                        <td className="py-3 px-4">
                          <div>
                            <span className="font-bold text-stone-900 block">{student.name}</span>
                            <span className="font-mono text-[10px] text-stone-400">{student.parent_phone}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <BeltBadge beltName={belt?.name} />
                        </td>
                        <td className="py-3 px-4 font-mono font-medium">{inr(fee.amount_due)}</td>
                        <td className="py-3 px-4 font-mono text-stone-500">{selectedMonth}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-600">{inr(fee.amount_paid)}</td>
                        <td className="py-3 px-4 font-mono font-bold" style={{ color: balance > 0 ? '#d97706' : '#16a34a' }}>
                          {inr(balance)}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={effectiveStatus} />
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-400 text-[11px]">
                          {fee.payment_date ? fmtDate(fee.payment_date) : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {balance > 0 && (
                              <button
                                onClick={() => setPayingStudent({ student, fee })}
                                className="h-7 px-2.5 rounded-lg text-white font-bold text-[11px] bg-emerald-600 hover:bg-emerald-700 cursor-pointer transition active:scale-95 shadow-2xs"
                              >
                                Collect
                              </button>
                            )}
                            {fee.payment_status === 'PAID' && (
                              <button
                                onClick={() => setSelectedReceipt({ fee, student })}
                                className="h-7 px-2.5 rounded-lg border text-stone-700 font-bold text-[11px] hover:bg-stone-100 cursor-pointer transition active:scale-95"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                Receipt
                              </button>
                            )}
                            {balance > 0 && (
                              <button
                                onClick={() => handleSendReminder(student, balance)}
                                className="h-7 px-2.5 rounded-lg text-white font-bold text-[11px] cursor-pointer transition active:scale-95 shadow-2xs flex items-center gap-1 hover:brightness-105"
                                style={{ background: '#25D366' }}
                                title="Send WhatsApp Reminder for unpaid fee"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>Reminder</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards (md:hidden) */}
          <div className="md:hidden space-y-3">
            {filteredRows.map(({ student, fee, effectiveStatus, balance }) => {
              const belt = beltLevels.find((b) => b.id === student.belt_level_id);
              return (
                <div key={student.id} className="bg-white rounded-2xl border p-4 shadow-2xs space-y-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-sm text-stone-900 block">{student.name}</span>
                      <div className="mt-1">
                        <BeltBadge beltName={belt?.name} />
                      </div>
                    </div>
                    <StatusBadge status={effectiveStatus} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-stone-100">
                    <div>
                      <span className="text-[10px] text-stone-400 block font-semibold">DUE / PAID</span>
                      <span className="font-mono">{inr(fee.amount_due)} / {inr(fee.amount_paid)}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-stone-400 block font-semibold">BALANCE DUE</span>
                      <span className="font-mono font-bold text-amber-600">{inr(balance)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    {balance > 0 && (
                      <button
                        onClick={() => setPayingStudent({ student, fee })}
                        className="flex-1 h-8 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                      >
                        Collect Fee
                      </button>
                    )}
                    {fee.payment_status === 'PAID' && (
                      <button
                        onClick={() => setSelectedReceipt({ fee, student })}
                        className="flex-1 h-8 rounded-xl border border-stone-300 font-bold text-xs"
                      >
                        Receipt
                      </button>
                    )}
                    {balance > 0 && (
                      <button
                        onClick={() => handleSendReminder(student, balance)}
                        className="h-8 px-3 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                        style={{ background: '#25D366' }}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>Reminder</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Tab 2: Transaction History */
        <div className="bg-white rounded-2xl border shadow-2xs overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b text-stone-500 uppercase tracking-wider font-bold" style={{ borderColor: 'var(--border)' }}>
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Month</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4 text-right">Amount Paid</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {transactionHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400">
                    No transactions recorded yet
                  </td>
                </tr>
              ) : (
                transactionHistory.map((fee) => {
                  const student = db.getStudent(fee.student_id);
                  return (
                    <tr key={fee.id} className="hover:bg-stone-50/60 transition">
                      <td className="py-3 px-4 font-mono">{fee.payment_date ? fmtDate(fee.payment_date) : '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-stone-800">{fee.receipt_number || 'RCP-DRAFT'}</td>
                      <td className="py-3 px-4 font-bold text-stone-900">{student?.name || 'Unknown'}</td>
                      <td className="py-3 px-4 font-mono text-stone-500">{fmtMonth(fee.month)}</td>
                      <td className="py-3 px-4 uppercase font-bold text-[10px] tracking-wider text-stone-600">{fee.payment_mode}</td>
                      <td className="py-3 px-4 font-mono font-black text-emerald-600 text-right">{inr(fee.amount_paid)}</td>
                      <td className="py-3 px-4 text-right">
                        {student && (
                          <button
                            onClick={() => setSelectedReceipt({ fee, student })}
                            className="h-7 px-2.5 rounded-lg border text-stone-700 font-bold text-[11px] hover:bg-stone-100 cursor-pointer"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            View Receipt
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Collect Fee Modal */}
      {payingStudent && (
        <CollectFeeModal
          student={payingStudent.student}
          fee={payingStudent.fee}
          month={selectedMonth}
          settings={settings}
          onClose={() => setPayingStudent(null)}
        />
      )}

      {/* Receipt Modal */}
      {selectedReceipt && (
        <FeeReceiptModal
          fee={selectedReceipt.fee}
          student={selectedReceipt.student}
          settings={settings}
          belt={beltLevels.find((b) => b.id === selectedReceipt.student.belt_level_id)}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}

// Subcomponent: Collect Payment Modal
function CollectFeeModal({
  student,
  fee,
  month,
  settings,
  onClose,
}: {
  student: Student;
  fee?: FeeRecord;
  month: string;
  settings?: any;
  onClose: () => void;
}) {
  const defaultDue = fee ? fee.amount_due - fee.amount_paid : student.monthly_fee || 1500;
  const [amountReceived, setAmountReceived] = useState(defaultDue);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK' | 'ONLINE'>('UPI');
  const [notes, setNotes] = useState('');
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountReceived <= 0) return toast.error('Enter a valid payment amount');

    setLoading(true);
    try {
      const result = await db.recordPayment({
        student_id: student.id,
        month,
        amount_paid: Number(amountReceived),
        payment_mode: paymentMode,
        notes,
      });

      toast.success(`Payment recorded! Receipt #${result.receipt_number}`);

      // If WhatsApp receipt checked
      if (sendWhatsApp) {
        const belt = db.getBeltLevels().find((b) => b.id === student.belt_level_id);
        await shareReceiptToWhatsApp({
          fee: result.fee,
          student,
          settings,
          belt,
        });
      }

      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border p-6 max-w-md w-full" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: 'var(--border)' }}>
          <div>
            <h3 className="text-lg font-black" style={{ color: 'var(--primary)' }}>
              Collect Fee Payment
            </h3>
            <p className="text-xs text-stone-500 font-medium">{student.name} · {fmtMonth(month)}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmPayment} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex justify-between items-center">
            <span className="text-stone-500 font-semibold">Current Balance Due:</span>
            <span className="text-base font-mono font-black text-amber-600">{inr(defaultDue)}</span>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Amount Received (₹) *</label>
            <input
              type="number"
              required
              min={1}
              value={amountReceived}
              onChange={(e) => setAmountReceived(Number(e.target.value))}
              className="w-full h-12 px-3 rounded-xl border text-xl font-mono font-black tracking-wide"
              style={{ borderColor: 'var(--border)', background: 'var(--input)', color: 'var(--primary)' }}
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1.5">Payment Mode *</label>
            <div className="grid grid-cols-4 gap-2">
              {(['CASH', 'UPI', 'BANK', 'ONLINE'] as const).map((mode) => (
                <button
                  type="button"
                  key={mode}
                  onClick={() => setPaymentMode(mode)}
                  className={`h-9 rounded-xl font-bold text-xs border transition cursor-pointer ${
                    paymentMode === mode
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)] shadow-2xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-stone-700 mb-1">Notes / Transaction Reference (Optional)</label>
            <input
              type="text"
              placeholder="e.g. UPI Ref: 9876234"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border text-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendWhatsApp}
              onChange={(e) => setSendWhatsApp(e.target.checked)}
              className="h-4 w-4 rounded-sm text-emerald-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-xs font-semibold text-stone-800">
              Send WhatsApp Receipt to {student.parent_phone} immediately
            </span>
          </label>

          <div className="flex gap-3 pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border font-semibold text-xs cursor-pointer hover:bg-stone-50"
              style={{ borderColor: 'var(--border)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-xl text-white font-bold text-xs cursor-pointer transition active:scale-95 shadow-xs disabled:opacity-60"
              style={{ background: 'var(--primary)' }}
            >
              {loading ? 'Processing...' : '✓ Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
