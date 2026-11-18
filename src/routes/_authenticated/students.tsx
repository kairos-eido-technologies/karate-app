import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Calendar,
  CreditCard,
  MessageSquare,
  Edit2,
  Check,
  X,
  Clock,
  Shield,
  Trash2,
  ChevronLeft,
} from 'lucide-react';
import { db } from '@/lib/db/db';
import { inr, fmtDate, fmtMonth } from '@/lib/format';
import { openWhatsApp, buildReminderMessage } from '@/lib/whatsapp';
import { PageHeader } from '@/components/PageHeader';
import { BeltBadge } from '@/components/BeltBadge';
import { StatusBadge } from '@/components/StatusBadge';
import { PaginationControls } from '@/components/PaginationControls';
import { FeeReceiptModal } from '@/components/FeeReceiptModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import { toast } from 'sonner';
import { format, subMonths, eachDayOfInterval, startOfMonth, endOfMonth } from 'date-fns';
import type { Student, FeeRecord } from '@/lib/db/types';

export const Route = createFileRoute('/_authenticated/students')({
  component: StudentsPage,
});

function StudentsPage() {
  const [, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileView, setMobileView] = useState<'list' | 'profile'>('list');
  const pageSize = 20;

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedReceiptFee, setSelectedReceiptFee] = useState<FeeRecord | null>(null);
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);

  // Active profile tab
  const [profileTab, setProfileTab] = useState<'attendance' | 'fees'>('attendance');

  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  const students = db.getStudents(false);
  const settings = db.getSettings();
  const beltLevels = db.getBeltLevels();
  const currentMonthStr = new Date().toISOString().slice(0, 7);

  // Filter students
  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.parent_phone.includes(q) || s.phone.includes(q);
  });

  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Selected student
  const activeStudent = students.find((s) => s.id === selectedStudentId) || paginatedStudents[0] || null;

  // Current selected student fees & attendance
  const studentFees = activeStudent ? db.getFees().filter((f) => f.student_id === activeStudent.id) : [];
  const studentAttendance = activeStudent ? db.getAttendance().filter((a) => a.student_id === activeStudent.id) : [];

  // Quick stats
  const totalPaid = studentFees.reduce((acc, f) => acc + (f.amount_paid || 0), 0);
  const currentMonthFee = studentFees.find((f) => f.month === currentMonthStr);
  const balanceDue = currentMonthFee ? (currentMonthFee.amount_due - currentMonthFee.amount_paid) : 0;
  const totalDaysMarked = studentAttendance.length;
  const presentDays = studentAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const attendanceRate = totalDaysMarked > 0 ? Math.round((presentDays / totalDaysMarked) * 100) : 100;

  // Handle WhatsApp Reminder
  const handleSendReminder = (s: Student) => {
    const msg = buildReminderMessage({
      academyName: settings?.academy_name || 'Dojo Master Academy',
      parentName: s.parent_name,
      studentName: s.name,
      amount: s.monthly_fee || 1500,
      month: fmtMonth(currentMonthStr),
      phone: settings?.phone || '',
    });
    openWhatsApp(s.parent_phone, msg);
    toast.info('WhatsApp opened. Confirm send in WhatsApp.');
    // Log
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

  // Soft delete student
  const handleDeleteStudent = async (s: Student) => {
    try {
      await db.push([{ type: 'DELETE_STUDENT', payload: { id: s.id } }]);
      toast.success(`${s.name} marked inactive.`);
      setDeleteConfirmStudent(null);
    } catch {
      toast.error('Failed to update student.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Student Management"
        subtitle={`Managing ${students.length} karate students`}
        action={
          <button
            onClick={() => {
              setEditingStudent(null);
              setIsAddModalOpen(true);
            }}
            className="h-10 px-4 rounded-xl font-bold text-xs text-white flex items-center gap-2 cursor-pointer transition active:scale-95 shadow-xs"
            style={{ background: 'var(--primary)' }}
          >
            <Plus className="h-4 w-4" />
            Add New Student
          </button>
        }
      />

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Panel: Student List (5 cols) */}
        <div className={`${mobileView === 'list' ? 'block' : 'hidden'} lg:block lg:col-span-5 bg-white rounded-2xl border p-4 shadow-2xs space-y-4`} style={{ borderColor: 'var(--border)' }}>
          {/* Search bar */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-9 pr-4 rounded-xl border text-xs font-medium"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          {/* Student list */}
          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {paginatedStudents.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">No students found</div>
            ) : (
              paginatedStudents.map((s) => {
                const belt = beltLevels.find((b) => b.id === s.belt_level_id);
                const feeThisMonth = db.getFees().find((f) => f.student_id === s.id && f.month === currentMonthStr);
                const isPaid = feeThisMonth?.payment_status === 'PAID';
                const isSelected = activeStudent?.id === s.id;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedStudentId(s.id);
                      setMobileView('profile');
                    }}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'border-l-4 shadow-2xs'
                        : 'hover:bg-stone-50 border-stone-200'
                    }`}
                    style={{
                      borderColor: isSelected ? 'var(--primary)' : undefined,
                      borderLeftColor: isSelected ? 'var(--primary)' : undefined,
                      background: isSelected ? 'rgba(139, 26, 26, 0.04)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar initials */}
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs"
                        style={{ background: 'rgba(139, 26, 26, 0.12)', color: 'var(--primary)' }}
                      >
                        {s.name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-stone-900">{s.name}</span>
                          {s.status === 'INACTIVE' && (
                            <span className="text-[10px] text-stone-400 font-medium">(Inactive)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <BeltBadge beltName={belt?.name} />
                          <span className="text-[11px] font-mono text-stone-500">{s.parent_phone}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fee Status Indicator */}
                    <div className="text-right">
                      {isPaid ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <Check className="h-2.5 w-2.5" /> Paid
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Due: {inr(feeThisMonth ? feeThisMonth.amount_due - feeThisMonth.amount_paid : s.monthly_fee)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredStudents.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Right Panel: Student Profile (7 cols) */}
        <div className={`${mobileView === 'profile' ? 'block' : 'hidden'} lg:block lg:col-span-7 bg-white rounded-2xl border p-4 sm:p-6 shadow-2xs space-y-6`} style={{ borderColor: 'var(--border)' }}>
          {/* Mobile Back Button */}
          <button
            onClick={() => setMobileView('list')}
            className="lg:hidden flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border border-[var(--border)] bg-stone-50 hover:bg-stone-100 transition cursor-pointer w-fit"
            style={{ color: 'var(--primary)' }}
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Student List
          </button>
          {activeStudent ? (
            <>
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-4">
                  <div
                    className="h-16 w-16 rounded-2xl flex items-center justify-center font-black text-xl border shadow-2xs"
                    style={{ background: 'var(--primary)', color: '#FFFFFF', borderColor: 'var(--border)' }}
                  >
                    {activeStudent.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-black text-stone-900">{activeStudent.name}</h2>
                      <StatusBadge status={activeStudent.status === 'ACTIVE' ? 'PAID' : 'UNPAID'} label={activeStudent.status} />
                    </div>
                    <p className="text-xs text-stone-500 font-medium mt-1">
                      Enrolled on {activeStudent.enrollment_date ? fmtDate(activeStudent.enrollment_date) : 'N/A'}
                    </p>
                    <div className="mt-2">
                      <BeltBadge beltName={beltLevels.find((b) => b.id === activeStudent.belt_level_id)?.name} />
                    </div>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setEditingStudent(activeStudent);
                      setIsAddModalOpen(true);
                    }}
                    className="h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95 hover:bg-stone-50"
                    style={{ borderColor: 'var(--border)', color: 'var(--foreground)' }}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleSendReminder(activeStudent)}
                    className="h-9 px-3 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition active:scale-95 shadow-xs"
                    style={{ background: '#25D366' }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>
                  {activeStudent.status === 'ACTIVE' && (
                    <button
                      onClick={() => setDeleteConfirmStudent(activeStudent)}
                      className="h-9 w-9 rounded-xl border flex items-center justify-center text-stone-400 hover:text-red-600 transition cursor-pointer"
                      style={{ borderColor: 'var(--border)' }}
                      title="Deactivate Student"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Stats Strip (4 cards) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Total Fees Paid</span>
                  <span className="text-base font-mono font-black text-emerald-700">{inr(totalPaid)}</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Current Balance</span>
                  <span className={`text-base font-mono font-black ${balanceDue > 0 ? 'text-amber-600' : 'text-stone-700'}`}>
                    {inr(balanceDue)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Attendance %</span>
                  <span className="text-base font-mono font-black text-stone-900">{attendanceRate}%</span>
                </div>
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-[10px] font-bold text-stone-500 uppercase block">Monthly Fee</span>
                  <span className="text-base font-mono font-black text-stone-900">{inr(activeStudent.monthly_fee)}</span>
                </div>
              </div>

              {/* Student Details Grid */}
              <div className="p-4 rounded-xl bg-stone-50/70 border border-stone-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 font-semibold block text-[10px]">PARENT / GUARDIAN</span>
                  <span className="font-bold text-stone-900">{activeStudent.parent_name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-stone-400 font-semibold block text-[10px]">PARENT WHATSAPP</span>
                  <span className="font-mono font-bold text-stone-900">{activeStudent.parent_phone}</span>
                </div>
                <div>
                  <span className="text-stone-400 font-semibold block text-[10px]">STUDENT PHONE</span>
                  <span className="font-mono text-stone-700">{activeStudent.phone || '—'}</span>
                </div>
                <div>
                  <span className="text-stone-400 font-semibold block text-[10px]">DATE OF BIRTH</span>
                  <span className="font-mono text-stone-700">{activeStudent.dob ? fmtDate(activeStudent.dob) : '—'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-stone-400 font-semibold block text-[10px]">NOTES / MEDICAL</span>
                  <span className="text-stone-700">{activeStudent.notes || 'No special notes recorded.'}</span>
                </div>
              </div>

              {/* Tabs: Attendance History vs Fee History */}
              <div>
                <div className="flex border-b border-stone-200 mb-4">
                  <button
                    onClick={() => setProfileTab('attendance')}
                    className={`pb-2.5 px-4 text-xs font-bold cursor-pointer transition border-b-2 ${
                      profileTab === 'attendance'
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Attendance History
                  </button>
                  <button
                    onClick={() => setProfileTab('fees')}
                    className={`pb-2.5 px-4 text-xs font-bold cursor-pointer transition border-b-2 ${
                      profileTab === 'fees'
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'border-transparent text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    Fee Payment History ({studentFees.length})
                  </button>
                </div>

                {profileTab === 'attendance' ? (
                  <div className="space-y-4">
                    <p className="text-xs text-stone-500 font-medium">
                      Summary: <span className="font-bold text-stone-800">{presentDays}</span> days present out of{' '}
                      <span className="font-bold text-stone-800">{totalDaysMarked}</span> recorded training sessions ({attendanceRate}%)
                    </p>

                    {/* 3 mini calendar blocks */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[0, 1, 2].map((offset) => {
                        const mDate = subMonths(new Date(), offset);
                        const days = eachDayOfInterval({
                          start: startOfMonth(mDate),
                          end: endOfMonth(mDate),
                        });
                        return (
                          <div key={offset} className="p-3 rounded-xl border border-stone-200 bg-stone-50">
                            <span className="text-xs font-bold text-stone-800 block mb-2">{format(mDate, 'MMM yyyy')}</span>
                            <div className="grid grid-cols-7 gap-1">
                              {days.map((d) => {
                                const dStr = format(d, 'yyyy-MM-dd');
                                const record = studentAttendance.find((a) => a.date === dStr);
                                let bg = '#E5E7EB'; // unrecorded
                                if (record?.status === 'PRESENT') bg = '#16a34a';
                                else if (record?.status === 'ABSENT') bg = '#dc2626';
                                else if (record?.status === 'LATE') bg = '#d97706';
                                else if (record?.status === 'LEAVE') bg = '#6B7280';

                                return (
                                  <div
                                    key={dStr}
                                    title={`${dStr}: ${record?.status || 'No session'}`}
                                    className="h-4 w-full rounded-xs transition hover:scale-110"
                                    style={{ background: bg }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-stone-500 justify-end pt-1">
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-emerald-600" /> Present</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-rose-600" /> Absent</span>
                      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> Late</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {studentFees.length === 0 ? (
                      <p className="text-xs text-stone-400 py-6 text-center">No fee records found</p>
                    ) : (
                      studentFees.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-3 rounded-xl border border-stone-200 bg-stone-50 text-xs"
                        >
                          <div>
                            <span className="font-bold text-stone-900 block">{fmtMonth(f.month)}</span>
                            <span className="text-[10px] font-mono text-stone-500">
                              Paid: {inr(f.amount_paid)} / Due: {inr(f.amount_due)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={f.payment_status} />
                            {f.payment_status === 'PAID' && (
                              <button
                                onClick={() => setSelectedReceiptFee(f)}
                                className="h-7 px-2.5 rounded-lg border text-[11px] font-bold cursor-pointer hover:bg-stone-200"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                Receipt
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
            ) : (
              <div className="py-20 text-center text-stone-400 text-sm">Select a student from the list</div>
            )}
          </div>
        </div>

      {/* Add / Edit Student Modal */}
      {isAddModalOpen && (
        <StudentModal
          student={editingStudent}
          beltLevels={beltLevels}
          defaultFee={settings?.monthly_fee_default || 1500}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* Fee Receipt Modal */}
      {selectedReceiptFee && activeStudent && (
        <FeeReceiptModal
          fee={selectedReceiptFee}
          student={activeStudent}
          settings={settings}
          belt={beltLevels.find((b) => b.id === activeStudent.belt_level_id)}
          onClose={() => setSelectedReceiptFee(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmStudent && (
        <ConfirmModal
          title={`Deactivate ${deleteConfirmStudent.name}?`}
          message="This will change the student status to INACTIVE. Their attendance and fee history will be safely preserved."
          confirmLabel="Deactivate"
          destructive
          onConfirm={() => handleDeleteStudent(deleteConfirmStudent)}
          onCancel={() => setDeleteConfirmStudent(null)}
        />
      )}
    </div>
  );
}

// Subcomponent: Add / Edit Student Modal
function StudentModal({
  student,
  beltLevels,
  defaultFee,
  onClose,
}: {
  student: Student | null;
  beltLevels: Array<{ id: number; name: string }>;
  defaultFee: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(student?.name || '');
  const [dob, setDob] = useState(student?.dob || '');
  const [beltLevelId, setBeltLevelId] = useState(student?.belt_level_id || beltLevels[0]?.id || 1);
  const [monthlyFee, setMonthlyFee] = useState<string | number>(
    student?.monthly_fee !== undefined
      ? student.monthly_fee
      : defaultFee && defaultFee > 0
      ? defaultFee
      : ''
  );
  const [phone, setPhone] = useState(student?.phone || '');
  const [parentName, setParentName] = useState(student?.parent_name || '');
  const [parentPhone, setParentPhone] = useState(student?.parent_phone || '');
  const [enrollmentDate, setEnrollmentDate] = useState(student?.enrollment_date || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(student?.notes || '');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>(student?.status || 'ACTIVE');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Student Name is required');
    if (!parentPhone.trim()) return toast.error('Parent WhatsApp Number is required');
    const feeNum = Number(monthlyFee);
    if (!monthlyFee || isNaN(feeNum) || feeNum <= 0) {
      return toast.error('Please enter a valid monthly fee amount');
    }

    setLoading(true);
    try {
      const payload: Student = {
        id: student?.id || crypto.randomUUID(),
        name: name.trim(),
        dob: dob || undefined,
        belt_level_id: Number(beltLevelId),
        monthly_fee: feeNum,
        phone: phone.trim(),
        parent_name: parentName.trim(),
        parent_phone: parentPhone.trim(),
        enrollment_date: enrollmentDate,
        status,
        notes: notes.trim(),
      };

      if (student?.id) {
        await db.push([{ type: 'UPDATE_STUDENT', payload }]);
        toast.success(`Updated ${name}`);
      } else {
        await db.push([{ type: 'CREATE_STUDENT', payload }]);
        toast.success(`Enrolled ${name} successfully!`);
      }
      onClose();
    } catch {
      toast.error('Failed to save student.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-xl border p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between pb-4 border-b mb-4" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-lg font-black" style={{ color: 'var(--primary)' }}>
            {student ? 'Edit Student Profile' : 'Enroll New Karate Student'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Student Full Name - Full Line */}
          <div>
            <label className="block font-bold text-stone-700 mb-1">Student Full Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student Full Name"
              className="w-full h-10 px-3 rounded-xl border text-sm"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          {/* Belt Level & Monthly Fee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Belt Level *</label>
              <select
                value={beltLevelId}
                onChange={(e) => setBeltLevelId(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-xl border text-xs font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              >
                {beltLevels.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} Belt
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Monthly Fee (₹) *</label>
              <input
                type="number"
                required
                min={1}
                value={monthlyFee}
                onChange={(e) => setMonthlyFee(e.target.value === '' ? '' : e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-sm font-mono font-bold"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>
          </div>

          {/* Date of Birth & Enrollment Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Enrollment Date</label>
              <input
                type="date"
                value={enrollmentDate}
                onChange={(e) => setEnrollmentDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border text-xs"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>
          </div>

          {/* Parent Name - Standalone Full Line */}
          <div>
            <label className="block font-bold text-stone-700 mb-1">Parent / Guardian Name *</label>
            <input
              type="text"
              required
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              placeholder="Parent / Guardian Name"
              className="w-full h-10 px-3 rounded-xl border text-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          {/* Parent WhatsApp Number - Standalone Next Line */}
          <div>
            <label className="block font-bold text-stone-700 mb-1">Parent WhatsApp Number *</label>
            <input
              type="text"
              required
              value={parentPhone}
              onChange={(e) => setParentPhone(e.target.value)}
              placeholder="10-digit mobile number"
              className="w-full h-10 px-3 rounded-xl border text-xs font-mono"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

          {/* Student Phone & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-stone-700 mb-1">Student Phone (Optional)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Student mobile number"
                className="w-full h-10 px-3 rounded-xl border text-xs font-mono"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              />
            </div>

            <div>
              <label className="block font-bold text-stone-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border text-xs font-semibold"
                style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Notes / Medical Conditions */}
          <div>
            <label className="block font-bold text-stone-700 mb-1">Notes / Medical Conditions</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Medical notes, allergies, or belt goals (optional)"
              rows={2}
              className="w-full p-2.5 rounded-xl border text-xs"
              style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
            />
          </div>

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
              {loading ? 'Saving...' : student ? 'Save Changes' : 'Confirm Enrollment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
