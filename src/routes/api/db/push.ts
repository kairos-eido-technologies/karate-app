import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/db/push')({
  POST: async ({ request }) => {
    try {
      const { mutations } = await request.json();
      const applyMutations = sqlite.transaction((muts: any[]) => {
        for (const m of muts) {
          switch (m.type) {
            case 'CREATE_STUDENT':
              sqlite.prepare(`
                INSERT OR REPLACE INTO students(id, name, dob, phone, parent_name, parent_phone, belt_level_id, monthly_fee, enrollment_date, status, notes)
                VALUES(@id, @name, @dob, @phone, @parent_name, @parent_phone, @belt_level_id, @monthly_fee, @enrollment_date, @status, @notes)
              `).run(m.payload);
              break;
            case 'UPDATE_STUDENT':
              sqlite.prepare(`
                UPDATE students
                SET name=@name, dob=@dob, phone=@phone, parent_name=@parent_name, parent_phone=@parent_phone,
                    belt_level_id=@belt_level_id, monthly_fee=@monthly_fee, status=@status, notes=@notes, updated_at=datetime('now')
                WHERE id=@id
              `).run(m.payload);
              break;
            case 'DELETE_STUDENT':
              sqlite.prepare("UPDATE students SET status='INACTIVE' WHERE id=@id").run(m.payload);
              break;
            case 'UPSERT_ATTENDANCE':
              sqlite.prepare(`
                INSERT OR REPLACE INTO attendance(id, student_id, date, status, notes)
                VALUES(@id, @student_id, @date, @status, @notes)
              `).run(m.payload);
              break;
            case 'BULK_ATTENDANCE':
              for (const rec of m.payload) {
                sqlite.prepare(`
                  INSERT OR REPLACE INTO attendance(id, student_id, date, status, notes)
                  VALUES(@id, @student_id, @date, @status, @notes)
                `).run(rec);
              }
              break;
            case 'PAY_FEE':
            case 'CREATE_FEE':
              sqlite.prepare(`
                INSERT INTO fees(id, student_id, month, amount_due, amount_paid, payment_status, payment_date, payment_mode, receipt_number, notes)
                VALUES(@id, @student_id, @month, @amount_due, @amount_paid, @payment_status, @payment_date, @payment_mode, @receipt_number, @notes)
                ON CONFLICT(id) DO UPDATE SET
                  amount_due=excluded.amount_due,
                  amount_paid=excluded.amount_paid,
                  payment_status=excluded.payment_status,
                  payment_date=excluded.payment_date,
                  payment_mode=excluded.payment_mode,
                  receipt_number=excluded.receipt_number,
                  notes=excluded.notes,
                  updated_at=datetime('now')
              `).run({
                id: m.payload.id,
                student_id: m.payload.student_id,
                month: m.payload.month,
                amount_due: m.payload.amount_due || 1500,
                amount_paid: m.payload.amount_paid || 0,
                payment_status: m.payload.payment_status || 'UNPAID',
                payment_date: m.payload.payment_date || null,
                payment_mode: m.payload.payment_mode || 'CASH',
                receipt_number: m.payload.receipt_number || null,
                notes: m.payload.notes || '',
              });
              break;
            case 'LOG_WHATSAPP':
              sqlite.prepare(`
                INSERT INTO whatsapp_log(id, student_id, phone, message_type, message, status)
                VALUES(@id, @student_id, @phone, @message_type, @message, @status)
              `).run(m.payload);
              break;
            case 'UPDATE_SETTINGS':
              sqlite.prepare(`
                UPDATE settings
                SET academy_name=@academy_name, address=@address, phone=@phone, whatsapp_number=@whatsapp_number,
                    logo_path=@logo_path, monthly_fee_default=@monthly_fee_default, fee_due_day=@fee_due_day, updated_at=datetime('now')
                WHERE id=1
              `).run(m.payload);
              break;
          }
        }
      });
      applyMutations(mutations);
      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
