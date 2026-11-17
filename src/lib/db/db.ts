import type { Student, AttendanceRecord, FeeRecord, BeltLevel, Settings, WhatsAppLog, DbStore, User } from './types';
import { dexieDb } from './dexie-db';

export type { Student, AttendanceRecord, FeeRecord, BeltLevel, Settings, WhatsAppLog, DbStore, User };

export type Mutation =
  | { type: 'CREATE_STUDENT'; payload: Student }
  | { type: 'UPDATE_STUDENT'; payload: Partial<Student> & { id: string } }
  | { type: 'DELETE_STUDENT'; payload: { id: string } }
  | { type: 'UPSERT_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'BULK_ATTENDANCE'; payload: AttendanceRecord[] }
  | { type: 'CLEAR_ATTENDANCE_DATE'; payload: { date: string } }
  | { type: 'PAY_FEE'; payload: Partial<FeeRecord> & { id: string } }
  | { type: 'CREATE_FEE'; payload: FeeRecord }
  | { type: 'LOG_WHATSAPP'; payload: WhatsAppLog }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<Settings> };

export const DEFAULT_BELT_LEVELS: BeltLevel[] = [
  { id: 1, name: 'White', rank: 1, color_hex: '#FFFFFF' },
  { id: 2, name: 'Yellow', rank: 2, color_hex: '#FBBF24' },
  { id: 3, name: 'Orange', rank: 3, color_hex: '#FB923C' },
  { id: 4, name: 'Green', rank: 4, color_hex: '#22C55E' },
  { id: 5, name: 'Blue', rank: 5, color_hex: '#3B82F6' },
  { id: 6, name: 'Purple', rank: 6, color_hex: '#A855F7' },
  { id: 7, name: 'Red', rank: 7, color_hex: '#EF4444' },
  { id: 8, name: 'Brown', rank: 8, color_hex: '#78350F' },
  { id: 9, name: 'Black', rank: 9, color_hex: '#18181B' },
];

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  academy_name: 'Dojo Master Academy',
  address: '',
  phone: '',
  whatsapp_number: '',
  logo_path: '',
  monthly_fee_default: 1500,
  fee_due_day: 1,
};

export const DEFAULT_USERS: User[] = [
  { id: 1, username: 'admin', role: 'ADMIN' },
];

const LOCAL_STORAGE_KEY = 'dojo_manager_local_store_v2';
const ADMIN_PIN_KEY = 'dojo_manager_admin_pin';

class Db {
  private store: DbStore = {
    students: [],
    attendance: [],
    fees: [],
    settings: DEFAULT_SETTINGS,
    beltLevels: DEFAULT_BELT_LEVELS,
    whatsappLog: [],
    users: DEFAULT_USERS,
  };
  private listeners: Set<() => void> = new Set();
  private pollInterval: any = null;
  private isInitialized = false;

  constructor() {
    this.initFromLocalStorage();
    this.initFromDexie();
  }

  private initFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          this.store = {
            students: parsed.students || [],
            attendance: parsed.attendance || [],
            fees: parsed.fees || [],
            settings: parsed.settings || DEFAULT_SETTINGS,
            beltLevels: parsed.beltLevels?.length ? parsed.beltLevels : DEFAULT_BELT_LEVELS,
            whatsappLog: parsed.whatsappLog || [],
            users: parsed.users || DEFAULT_USERS,
          };
        }
      }
    } catch {}
  }

  private async initFromDexie() {
    const local = dexieDb;
    if (!local || typeof window === 'undefined') return;
    try {
      const [students, attendance, fees, settingsList, beltLevels, whatsappLog, users] = await Promise.all([
        local.students.toArray(),
        local.attendance.toArray(),
        local.fees.toArray(),
        local.settings.toArray(),
        local.beltLevels.toArray(),
        local.whatsappLog.toArray(),
        local.users.toArray(),
      ]);

      const hasDexieData = students.length > 0 || attendance.length > 0 || fees.length > 0 || settingsList.length > 0;

      if (hasDexieData) {
        this.store = {
          students,
          attendance,
          fees,
          settings: settingsList[0] || this.store.settings || DEFAULT_SETTINGS,
          beltLevels: beltLevels.length > 0 ? beltLevels : DEFAULT_BELT_LEVELS,
          whatsappLog,
          users: users.length > 0 ? users : DEFAULT_USERS,
        };
        this.saveToLocalStorage();
        this.notify();
      } else {
        // First run on clean mobile/desktop: Seed Dexie with default belt levels and settings
        await local.transaction('rw', [local.settings, local.beltLevels, local.users], async () => {
          await local.settings.put(this.store.settings || DEFAULT_SETTINGS);
          for (const b of DEFAULT_BELT_LEVELS) {
            await local.beltLevels.put(b);
          }
          for (const u of DEFAULT_USERS) {
            await local.users.put(u);
          }
        });
      }
    } catch {
      // IndexedDB access may fail in private mode; localStorage handles it
    } finally {
      this.isInitialized = true;
    }
  }

  private saveToLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(this.store));
    } catch {}
  }

  private async persistStore() {
    this.saveToLocalStorage();
    const local = dexieDb;
    if (!local || typeof window === 'undefined') return;
    try {
      await local.transaction('rw', [
        local.students,
        local.attendance,
        local.fees,
        local.settings,
        local.beltLevels,
        local.whatsappLog,
        local.users,
      ], async () => {
        await local.students.clear();
        await local.students.bulkPut(this.store.students);

        await local.attendance.clear();
        await local.attendance.bulkPut(this.store.attendance);

        await local.fees.clear();
        await local.fees.bulkPut(this.store.fees);

        await local.settings.clear();
        if (this.store.settings) await local.settings.put(this.store.settings);

        await local.beltLevels.clear();
        await local.beltLevels.bulkPut(this.store.beltLevels);

        await local.whatsappLog.clear();
        await local.whatsappLog.bulkPut(this.store.whatsappLog);

        await local.users.clear();
        await local.users.bulkPut(this.store.users);
      });
    } catch {}
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  async fetchFromServer() {
    try {
      const res = await fetch('/api/db/pull');
      if (!res.ok) return;
      const data: DbStore = await res.json();
      if (data && typeof data === 'object') {
        // Safe merge without wiping local database
        const mergedStudents = [...this.store.students];
        if (Array.isArray(data.students)) {
          for (const s of data.students) {
            const idx = mergedStudents.findIndex((x) => x.id === s.id);
            if (idx >= 0) {
              mergedStudents[idx] = { ...mergedStudents[idx], ...s };
            } else {
              mergedStudents.push(s);
            }
          }
        }

        const mergedAttendance = [...this.store.attendance];
        if (Array.isArray(data.attendance)) {
          for (const a of data.attendance) {
            const idx = mergedAttendance.findIndex(
              (x) => x.student_id === a.student_id && x.date === a.date
            );
            if (idx >= 0) {
              mergedAttendance[idx] = { ...mergedAttendance[idx], ...a };
            } else {
              mergedAttendance.push(a);
            }
          }
        }

        const mergedFees = [...this.store.fees];
        if (Array.isArray(data.fees)) {
          for (const f of data.fees) {
            const idx = mergedFees.findIndex(
              (x) => x.student_id === f.student_id && x.month === f.month
            );
            if (idx >= 0) {
              // Only overwrite local if server has equal or more payment recorded
              if ((f.amount_paid || 0) >= (mergedFees[idx].amount_paid || 0)) {
                mergedFees[idx] = { ...mergedFees[idx], ...f };
              }
            } else {
              mergedFees.push(f);
            }
          }
        }

        this.store = {
          students: mergedStudents,
          attendance: mergedAttendance,
          fees: mergedFees,
          settings: data.settings || this.store.settings || DEFAULT_SETTINGS,
          beltLevels: data.beltLevels?.length ? data.beltLevels : this.store.beltLevels,
          whatsappLog: data.whatsappLog?.length ? data.whatsappLog : this.store.whatsappLog,
          users: data.users?.length ? data.users : this.store.users,
        };
        await this.persistStore();
        this.notify();
      }
    } catch {
      // Server not reachable (offline / standalone mobile) - continue running on local DB smoothly
    }
  }

  startPolling(intervalMs = 10000) {
    this.fetchFromServer();
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.pollInterval = setInterval(() => this.fetchFromServer(), intervalMs);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async push(mutations: Mutation[]) {
    // 1. Immediately apply mutations to local in-memory store
    for (const m of mutations) {
      switch (m.type) {
        case 'CREATE_STUDENT': {
          const idx = this.store.students.findIndex((s) => s.id === m.payload.id);
          if (idx >= 0) {
            this.store.students[idx] = { ...this.store.students[idx], ...m.payload };
          } else {
            this.store.students.push(m.payload);
          }
          break;
        }
        case 'UPDATE_STUDENT': {
          const idx = this.store.students.findIndex((s) => s.id === m.payload.id);
          if (idx >= 0) {
            this.store.students[idx] = { ...this.store.students[idx], ...m.payload };
          }
          break;
        }
        case 'DELETE_STUDENT': {
          const idx = this.store.students.findIndex((s) => s.id === m.payload.id);
          if (idx >= 0) {
            this.store.students[idx].status = 'INACTIVE';
          }
          break;
        }
        case 'UPSERT_ATTENDANCE': {
          const rec = m.payload;
          const idx = this.store.attendance.findIndex(
            (a) => a.student_id === rec.student_id && a.date === rec.date
          );
          if (idx >= 0) {
            this.store.attendance[idx] = { ...this.store.attendance[idx], ...rec };
          } else {
            this.store.attendance.push(rec);
          }
          break;
        }
        case 'BULK_ATTENDANCE': {
          for (const rec of m.payload) {
            const idx = this.store.attendance.findIndex(
              (a) => a.student_id === rec.student_id && a.date === rec.date
            );
            if (idx >= 0) {
              this.store.attendance[idx] = { ...this.store.attendance[idx], ...rec };
            } else {
              this.store.attendance.push(rec);
            }
          }
          break;
        }
        case 'CLEAR_ATTENDANCE_DATE': {
          this.store.attendance = this.store.attendance.filter((a) => a.date !== m.payload.date);
          break;
        }
        case 'CREATE_FEE': {
          const fee = m.payload;
          const idx = this.store.fees.findIndex(
            (f) => f.student_id === fee.student_id && f.month === fee.month
          );
          if (idx >= 0) {
            this.store.fees[idx] = { ...this.store.fees[idx], ...fee };
          } else {
            this.store.fees.push(fee);
          }
          break;
        }
        case 'PAY_FEE': {
          const payload = m.payload;
          const idx = this.store.fees.findIndex((f) => f.id === payload.id);
          if (idx >= 0) {
            this.store.fees[idx] = { ...this.store.fees[idx], ...payload };
          }
          break;
        }
        case 'LOG_WHATSAPP': {
          this.store.whatsappLog.unshift(m.payload);
          break;
        }
        case 'UPDATE_SETTINGS': {
          this.store.settings = { ...this.store.settings, ...m.payload } as Settings;
          break;
        }
      }
    }

    // 2. Persist to local Dexie & localStorage immediately
    await this.persistStore();
    this.notify();

    // 3. Optional background sync with server SQLite if available
    try {
      await fetch('/api/db/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: this.store.students,
          attendance: this.store.attendance,
          fees: this.store.fees,
          settings: this.store.settings,
        }),
      });
    } catch {
      // Local database is source of truth when running offline or without server
    }
  }

  // Record a payment directly (offline-first with optional server sync)
  async recordPayment(params: {
    student_id: string;
    month: string;
    amount_paid: number;
    payment_mode?: string;
    notes?: string;
    receipt_number?: string;
  }): Promise<{ success: boolean; receipt_number: string; fee: FeeRecord }> {
    const student = this.getStudent(params.student_id);
    const amountDue = student?.monthly_fee || 1500;
    const nowIso = new Date().toISOString().slice(0, 10);
    const receiptNo =
      params.receipt_number ||
      `RCP-${params.month.replace('-', '')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    let fee = this.store.fees.find(
      (f) => f.student_id === params.student_id && f.month === params.month
    );

    if (!fee) {
      fee = {
        id: crypto.randomUUID(),
        student_id: params.student_id,
        month: params.month,
        amount_due: amountDue,
        amount_paid: params.amount_paid,
        balance_due: Math.max(0, amountDue - params.amount_paid),
        payment_status: params.amount_paid >= amountDue ? 'PAID' : params.amount_paid > 0 ? 'PARTIAL' : 'UNPAID',
        payment_date: nowIso,
        payment_mode: params.payment_mode || 'CASH',
        receipt_number: receiptNo,
        notes: params.notes || '',
      };
      this.store.fees.push(fee);
    } else {
      const newTotalPaid = (fee.amount_paid || 0) + Number(params.amount_paid);
      fee.amount_paid = newTotalPaid;
      fee.balance_due = Math.max(0, (fee.amount_due || amountDue) - newTotalPaid);
      fee.payment_status = newTotalPaid >= fee.amount_due ? 'PAID' : newTotalPaid > 0 ? 'PARTIAL' : 'UNPAID';
      fee.payment_date = nowIso;
      fee.payment_mode = params.payment_mode || fee.payment_mode || 'CASH';
      fee.receipt_number = receiptNo;
      if (params.notes) fee.notes = params.notes;
    }

    await this.persistStore();
    this.notify();

    // Sync payment to server SQLite in background
    try {
      await fetch('/api/db/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mutations: [{ type: 'PAY_FEE', payload: fee }],
        }),
      });
    } catch {}

    try {
      await fetch('/api/fees/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: params.student_id,
          month: params.month,
          amount_paid: params.amount_paid,
          payment_mode: params.payment_mode || 'CASH',
          notes: params.notes || '',
          receipt_number: receiptNo,
        }),
      });
    } catch {}

    return { success: true, receipt_number: receiptNo, fee };
  }

  // Export full JSON database backup
  exportBackup() {
    const backupData = {
      app: 'DojoManager',
      version: 1,
      exportedAt: new Date().toISOString(),
      academyName: this.store.settings?.academy_name || 'Dojo Master Academy',
      store: {
        settings: this.store.settings,
        beltLevels: this.store.beltLevels,
        students: this.store.students,
        attendance: this.store.attendance,
        fees: this.store.fees,
        whatsappLog: this.store.whatsappLog,
        users: this.store.users,
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `DojoManager_Backup_${dateStr}.json`;

    if (typeof window !== 'undefined') {
      const androidBridge = (window as any).AndroidBridge;
      if (androidBridge && typeof androidBridge.saveBackup === 'function') {
        androidBridge.saveBackup(jsonString, filename);
        return backupData;
      }

      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    return backupData;
  }

  // Import / restore backup from file content
  async importBackup(rawJsonOrObject: string | Record<string, any>): Promise<{
    success: boolean;
    studentsCount: number;
    attendanceCount: number;
    feesCount: number;
    academyName: string;
  }> {
    let parsed: any;
    if (typeof rawJsonOrObject === 'string') {
      parsed = JSON.parse(rawJsonOrObject);
    } else {
      parsed = rawJsonOrObject;
    }

    // Support nested `{ store: ... }`, `{ data: ... }`, or direct root keys
    const data = parsed.store || parsed.data || parsed;

    if (!data.students && !data.attendance && !data.fees && !data.settings) {
      throw new Error('Invalid backup file: missing required dojo records.');
    }

    this.store = {
      students: Array.isArray(data.students) ? data.students : [],
      attendance: Array.isArray(data.attendance) ? data.attendance : [],
      fees: Array.isArray(data.fees) ? data.fees : [],
      settings: data.settings || this.store.settings || DEFAULT_SETTINGS,
      beltLevels: Array.isArray(data.beltLevels) && data.beltLevels.length > 0 ? data.beltLevels : DEFAULT_BELT_LEVELS,
      whatsappLog: Array.isArray(data.whatsappLog) ? data.whatsappLog : [],
      users: Array.isArray(data.users) && data.users.length > 0 ? data.users : DEFAULT_USERS,
    };

    // Save to local IndexedDB and localStorage
    await this.persistStore();
    this.notify();

    // Sync to server SQLite if server is reachable
    try {
      await fetch('/api/db/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restore: true,
          students: this.store.students,
          attendance: this.store.attendance,
          fees: this.store.fees,
          settings: this.store.settings,
        }),
      });
    } catch {}

    return {
      success: true,
      studentsCount: this.store.students.length,
      attendanceCount: this.store.attendance.length,
      feesCount: this.store.fees.length,
      academyName: this.store.settings?.academy_name || 'Dojo Master Academy',
    };
  }

  // Reset database to initial empty state
  async resetDatabase() {
    this.store = {
      students: [],
      attendance: [],
      fees: [],
      settings: DEFAULT_SETTINGS,
      beltLevels: DEFAULT_BELT_LEVELS,
      whatsappLog: [],
      users: DEFAULT_USERS,
    };
    await this.persistStore();
    this.notify();

    try {
      await fetch('/api/db/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restore: true,
          students: [],
          attendance: [],
          fees: [],
          settings: DEFAULT_SETTINGS,
        }),
      });
    } catch {}
  }

  // Validate admin login credentials offline or online
  validateCredentials(username: string, pin: string): boolean {
    const cleanUser = username.trim().toLowerCase();
    const cleanPin = pin.trim();

    if (cleanUser !== 'admin') return false;

    // Check custom PIN from localStorage
    if (typeof window !== 'undefined') {
      const storedCustomPin = localStorage.getItem(ADMIN_PIN_KEY);
      if (storedCustomPin && cleanPin === storedCustomPin) {
        return true;
      }
    }

    // Default PIN
    return cleanPin === '123456';
  }

  // Change Admin PIN (offline-first)
  changeAdminPin(newPin: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_PIN_KEY, newPin.trim());
    }
  }

  getStudents(activeOnly = false): Student[] {
    return activeOnly
      ? this.store.students.filter((s) => s.status === 'ACTIVE')
      : this.store.students;
  }

  getStudent(id: string): Student | undefined {
    return this.store.students.find((s) => s.id === id);
  }

  getAttendance(date?: string): AttendanceRecord[] {
    return date
      ? this.store.attendance.filter((a) => a.date === date)
      : this.store.attendance;
  }

  getFees(month?: string): FeeRecord[] {
    return month
      ? this.store.fees.filter((f) => f.month === month)
      : this.store.fees;
  }

  getSettings(): Settings | null {
    return this.store.settings;
  }

  getBeltLevels(): BeltLevel[] {
    return this.store.beltLevels;
  }

  getBeltLevel(id: number): BeltLevel | undefined {
    return this.store.beltLevels.find((b) => b.id === id);
  }

  getWhatsAppLog(): WhatsAppLog[] {
    return this.store.whatsappLog;
  }

  getStore(): DbStore {
    return this.store;
  }
}

export const db = new Db();
