export interface Student {
  id: string;
  name: string;
  dob?: string;
  phone: string;
  parent_name: string;
  parent_phone: string;
  belt_level_id: number;
  monthly_fee: number;
  enrollment_date: string;
  photo_path?: string;
  status: 'ACTIVE' | 'INACTIVE';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
  notes?: string;
  marked_at?: string;
}

export interface FeeRecord {
  id: string;
  student_id: string;
  month: string;
  amount_due: number;
  amount_paid: number;
  balance_due?: number;
  payment_status: 'PAID' | 'UNPAID' | 'PARTIAL';
  payment_date?: string;
  payment_mode?: string;
  receipt_number?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BeltLevel {
  id: number;
  name: string;
  rank: number;
  color_hex: string;
}

export interface Settings {
  id: number;
  academy_name: string;
  address: string;
  phone: string;
  whatsapp_number: string;
  logo_path: string;
  monthly_fee_default: number;
  fee_due_day: number;
  created_at?: string;
  updated_at?: string;
}

export interface WhatsAppLog {
  id: string;
  student_id?: string;
  phone: string;
  message_type: 'REMINDER' | 'RECEIPT' | 'CUSTOM';
  message: string;
  sent_at: string;
  status: 'SENT' | 'FAILED';
}

export interface User {
  id: number;
  username: string;
  role: string;
  created_at?: string;
}

export interface DbStore {
  students: Student[];
  attendance: AttendanceRecord[];
  fees: FeeRecord[];
  settings: Settings | null;
  beltLevels: BeltLevel[];
  whatsappLog: WhatsAppLog[];
  users: User[];
}
