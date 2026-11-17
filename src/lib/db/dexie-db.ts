import Dexie, { type EntityTable } from 'dexie';
import type { Student, AttendanceRecord, FeeRecord, Settings, BeltLevel, WhatsAppLog, User } from './types';

export const dexieDb = typeof window !== 'undefined'
  ? (new Dexie('DojoManagerLocalDB') as Dexie & {
      students: EntityTable<Student, 'id'>;
      attendance: EntityTable<AttendanceRecord, 'id'>;
      fees: EntityTable<FeeRecord, 'id'>;
      settings: EntityTable<Settings, 'id'>;
      beltLevels: EntityTable<BeltLevel, 'id'>;
      whatsappLog: EntityTable<WhatsAppLog, 'id'>;
      users: EntityTable<User, 'id'>;
    })
  : null;

if (dexieDb) {
  dexieDb.version(1).stores({
    students: 'id, name, status, belt_level_id, enrollment_date',
    attendance: 'id, student_id, date, status, [student_id+date]',
    fees: 'id, student_id, month, payment_status, [student_id+month]',
    settings: 'id',
    beltLevels: 'id, rank',
    whatsappLog: 'id, student_id, sent_at',
    users: 'id, username',
  });
}
