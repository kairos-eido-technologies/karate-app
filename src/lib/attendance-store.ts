import { create } from "zustand";

type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "LEAVE";

interface AttendanceState {
  selectedDate: string;
  marks: Record<string, AttendanceStatus>;
  setDate: (date: string) => void;
  setMark: (studentId: string, status: AttendanceStatus) => void;
  loadMarks: (records: Array<{ student_id: string; status: AttendanceStatus }>) => void;
  clearMarks: () => void;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  selectedDate: new Date().toISOString().split("T")[0],
  marks: {},
  setDate: (date) => set({ selectedDate: date, marks: {} }),
  setMark: (studentId, status) =>
    set((s) => ({ marks: { ...s.marks, [studentId]: status } })),
  loadMarks: (records) =>
    set({ marks: Object.fromEntries(records.map((r) => [r.student_id, r.status])) }),
  clearMarks: () => set({ marks: {} }),
}));
