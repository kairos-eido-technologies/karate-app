import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Search,
  Save,
  Check,
  AlertCircle,
} from 'lucide-react';
import { format, addDays, subDays, isAfter, startOfDay } from 'date-fns';
import { db } from '@/lib/db/db';
import { useAttendanceStore } from '@/lib/attendance-store';
import { PageHeader } from '@/components/PageHeader';
import { BeltBadge } from '@/components/BeltBadge';
import { toast } from 'sonner';
import type { AttendanceRecord } from '@/lib/db/types';

export const Route = createFileRoute('/_authenticated/attendance')({
  component: AttendancePage,
});

type StatusType = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

function AttendancePage() {
  const [, setTick] = useState(0);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { selectedDate, marks, setDate, setMark, loadMarks, clearMarks } = useAttendanceStore();

  useEffect(() => {
    return db.subscribe(() => setTick((t) => t + 1));
  }, []);

  // When date changes, load records from db
  useEffect(() => {
    const existing = db.getAttendance(selectedDate);
    loadMarks(existing);
    const existingNotes: Record<string, string> = {};
    existing.forEach((r) => {
      if (r.notes) existingNotes[r.student_id] = r.notes;
    });
    setNotes(existingNotes);
  }, [selectedDate]);

  const students = db.getStudents(true); // Active students
  const beltLevels = db.getBeltLevels();

  const currentDateObj = new Date(selectedDate);
  const isToday = format(currentDateObj, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  const isFuture = isAfter(startOfDay(currentDateObj), startOfDay(new Date()));

  // Filter students
  const filteredStudents = students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()));

  // Summary counts
  const presentCount = Object.values(marks).filter((s) => s === 'PRESENT').length;
  const absentCount = Object.values(marks).filter((s) => s === 'ABSENT').length;
  const lateCount = Object.values(marks).filter((s) => s === 'LATE').length;
  const leaveCount = Object.values(marks).filter((s) => s === 'LEAVE').length;
  const notMarkedCount = Math.max(0, students.length - (presentCount + absentCount + lateCount + leaveCount));

  // Date Navigation
  const handlePrevDay = () => {
    const prev = format(subDays(currentDateObj, 1), 'yyyy-MM-dd');
    setDate(prev);
  };

  const handleNextDay = () => {
    if (isToday) return;
    const next = format(addDays(currentDateObj, 1), 'yyyy-MM-dd');
    setDate(next);
  };

  const handleToday = () => {
    setDate(format(new Date(), 'yyyy-MM-dd'));
  };

  // Immediate mark save
  const handleMark = async (studentId: string, status: StatusType) => {
    setMark(studentId, status);
    // Instant background sync
    try {
      const record: AttendanceRecord = {
        id: crypto.randomUUID(),
        student_id: studentId,
        date: selectedDate,
        status,
        notes: notes[studentId] || '',
      };
      await db.push([{ type: 'UPSERT_ATTENDANCE', payload: record }]);
    } catch {}
  };

  // Save all marked records
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      const recordsToSave: AttendanceRecord[] = Object.entries(marks).map(([studentId, status]) => ({
        id: crypto.randomUUID(),
        student_id: studentId,
        date: selectedDate,
        status: status as StatusType,
        notes: notes[studentId] || '',
      }));
      if (recordsToSave.length > 0) {
        await db.push([{ type: 'BULK_ATTENDANCE', payload: recordsToSave }]);
      }
      toast.success(`Attendance saved successfully (${recordsToSave.length} marked)`);
    } catch {
      toast.error('Failed to save attendance.');
    } finally {
      setIsSaving(false);
    }
  };

  // Bulk actions
  const handleMarkAll = async (status: StatusType) => {
    const recordsToSave: AttendanceRecord[] = [];
    students.forEach((s) => {
      setMark(s.id, status);
      recordsToSave.push({
        id: crypto.randomUUID(),
        student_id: s.id,
        date: selectedDate,
        status,
        notes: notes[s.id] || '',
      });
    });

    try {
      await db.push([{ type: 'BULK_ATTENDANCE', payload: recordsToSave }]);
      toast.success(`Marked all ${students.length} students as ${status}!`);
    } catch {
      toast.error('Failed to save bulk attendance.');
    }
  };

  const handleClearAll = async () => {
    clearMarks();
    try {
      await db.push([{ type: 'CLEAR_ATTENDANCE_DATE', payload: { date: selectedDate } }]);
      toast.info('Cleared marks for this session.');
    } catch {
      toast.info('Cleared marks for this session.');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Attendance Management"
        subtitle="Mark training sessions with instant auto-save"
      />

      {/* Date Navigator Bar */}
      <div className="bg-white rounded-2xl border p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevDay}
            className="h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer transition active:scale-95 hover:bg-stone-50"
            style={{ borderColor: 'var(--border)' }}
            title="Previous Day"
          >
            <ChevronLeft className="h-5 w-5 text-stone-700" />
          </button>

          <button
            onClick={handleToday}
            className={`h-10 px-4 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
              isToday ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            Today
          </button>

          <button
            onClick={handleNextDay}
            disabled={isToday}
            className="h-10 w-10 rounded-xl border flex items-center justify-center cursor-pointer transition active:scale-95 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--border)' }}
            title="Next Day"
          >
            <ChevronRight className="h-5 w-5 text-stone-700" />
          </button>
        </div>

        {/* Center Date Display */}
        <div className="text-center">
          <span className="text-lg md:text-xl font-black text-stone-900 tracking-tight">
            {format(currentDateObj, 'EEEE, dd MMMM yyyy')}
          </span>
          {isToday && (
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              LIVE TODAY
            </span>
          )}
        </div>

        {/* Date picker jump */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            max={format(new Date(), 'yyyy-MM-dd')}
            value={selectedDate}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-10 px-3 rounded-xl border text-xs font-mono font-medium cursor-pointer"
            style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
          />
        </div>
      </div>

      {/* Attendance Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase block">Present</span>
            <span className="text-xl font-mono font-black text-emerald-700">{presentCount}</span>
          </div>
          <CheckCircle className="h-5 w-5 text-emerald-600 opacity-60" />
        </div>

        <div className="p-3 rounded-xl bg-rose-50/80 border border-rose-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-rose-800 uppercase block">Absent</span>
            <span className="text-xl font-mono font-black text-rose-700">{absentCount}</span>
          </div>
          <XCircle className="h-5 w-5 text-rose-600 opacity-60" />
        </div>

        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-amber-800 uppercase block">Late</span>
            <span className="text-xl font-mono font-black text-amber-700">{lateCount}</span>
          </div>
          <Clock className="h-5 w-5 text-amber-600 opacity-60" />
        </div>

        <div className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-stone-700 uppercase block">Leave</span>
            <span className="text-xl font-mono font-black text-stone-700">{leaveCount}</span>
          </div>
          <span className="text-base">🏖️</span>
        </div>

        <div className="p-3 rounded-xl bg-stone-100/80 border border-stone-300 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <span className="text-[10px] font-bold text-stone-600 uppercase block">Not Marked</span>
            <span className="text-xl font-mono font-black text-stone-600">{notMarkedCount}</span>
          </div>
          <AlertCircle className="h-5 w-5 text-stone-400" />
        </div>
      </div>

      {/* Bulk Action Bar & Search */}
      <div className="bg-white rounded-2xl border p-4 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleMarkAll('PRESENT')}
            className="h-9 px-3 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Mark All Present
          </button>
          <button
            onClick={() => handleMarkAll('ABSENT')}
            className="h-9 px-3 rounded-xl text-xs font-bold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <XCircle className="h-3.5 w-3.5" />
            Mark All Absent
          </button>
          <button
            onClick={handleClearAll}
            className="h-9 px-3 rounded-xl text-xs font-semibold text-stone-600 border border-stone-200 hover:bg-stone-100 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear All
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Filter student..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border text-xs"
            style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
          />
        </div>
      </div>

      {/* Desktop Attendance Table (hidden on mobile) */}
      <div className="hidden md:block bg-white rounded-2xl border shadow-2xs overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b text-stone-500 uppercase tracking-wider font-bold" style={{ borderColor: 'var(--border)' }}>
            <tr>
              <th className="py-3 px-4 w-12 text-center">#</th>
              <th className="py-3 px-4">Student Name</th>
              <th className="py-3 px-4">Belt Level</th>
              <th className="py-3 px-4 text-center">Mark Status</th>
              <th className="py-3 px-4">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-stone-400">
                  No students found matching "{search}"
                </td>
              </tr>
            ) : (
              filteredStudents.map((student, idx) => {
                const belt = beltLevels.find((b) => b.id === student.belt_level_id);
                const currentMark = marks[student.id];

                return (
                  <tr key={student.id} className="hover:bg-stone-50/60 transition">
                    <td className="py-3 px-4 text-center font-mono text-stone-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-[11px]"
                          style={{ background: 'rgba(139, 26, 26, 0.12)', color: 'var(--primary)' }}
                        >
                          {student.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-stone-900 block">{student.name}</span>
                          <span className="text-[10px] font-mono text-stone-400">{student.parent_phone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <BeltBadge beltName={belt?.name} />
                    </td>
                    <td className="py-3 px-4">
                      {/* P / A / L / X toggle button group */}
                      <div className="flex items-center justify-center gap-1.5">
                        {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map((s) => {
                          const isSelected = currentMark === s;
                          return (
                            <button
                              key={s}
                              onClick={() => handleMark(student.id, s)}
                              className={`h-8 px-3 rounded-lg text-xs font-bold transition cursor-pointer border active:scale-95 shadow-2xs ${
                                isSelected
                                  ? s === 'PRESENT'
                                    ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300'
                                    : s === 'ABSENT'
                                    ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300'
                                    : s === 'LATE'
                                    ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300'
                                    : 'bg-stone-600 text-white border-stone-600 ring-2 ring-stone-300'
                                  : 'bg-white text-stone-600 hover:bg-stone-100 border-stone-200'
                              }`}
                            >
                              {s === 'PRESENT' ? '✓ P' : s === 'ABSENT' ? '✗ A' : s === 'LATE' ? '⏰ L' : '🏖 X'}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="text"
                        placeholder="Add note..."
                        value={notes[student.id] || ''}
                        onChange={(e) => setNotes({ ...notes, [student.id]: e.target.value })}
                        className="h-8 px-2 rounded-lg border text-xs w-48 font-medium"
                        style={{ borderColor: 'var(--border)', background: 'var(--input)' }}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Attendance Cards (md:hidden) */}
      <div className="md:hidden space-y-3">
        {filteredStudents.map((student) => {
          const belt = beltLevels.find((b) => b.id === student.belt_level_id);
          const currentMark = marks[student.id];

          return (
            <div key={student.id} className="bg-white rounded-2xl border p-4 shadow-2xs space-y-3" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-stone-900 block">{student.name}</span>
                  <div className="mt-1">
                    <BeltBadge beltName={belt?.name} />
                  </div>
                </div>
                <span className="text-xs font-mono text-stone-400">{student.parent_phone}</span>
              </div>

              {/* Status buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {(['PRESENT', 'ABSENT', 'LATE', 'LEAVE'] as const).map((s) => {
                  const isSelected = currentMark === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleMark(student.id, s)}
                      className={`h-10 rounded-xl text-xs font-bold transition cursor-pointer border active:scale-95 ${
                        isSelected
                          ? s === 'PRESENT'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : s === 'ABSENT'
                            ? 'bg-rose-600 text-white border-rose-600'
                            : s === 'LATE'
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-stone-600 text-white border-stone-600'
                          : 'bg-stone-50 text-stone-600 border-stone-200'
                      }`}
                    >
                      {s === 'PRESENT' ? '✓ Pres' : s === 'ABSENT' ? '✗ Abs' : s === 'LATE' ? '⏰ Late' : '🏖 Leave'}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Save Bar */}
      <div className="sticky bottom-4 z-20 flex justify-center">
        <button
          onClick={handleSaveAll}
          disabled={isSaving}
          className="h-12 px-8 rounded-full text-white font-black text-sm shadow-xl flex items-center gap-2 cursor-pointer transition active:scale-95 hover:opacity-95"
          style={{ background: 'var(--primary)' }}
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving Attendance...' : `Save Attendance (${Object.keys(marks).length} marked)`}
        </button>
      </div>
    </div>
  );
}
