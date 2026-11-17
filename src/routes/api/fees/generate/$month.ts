import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../../server/db';
import { v4 as uuidv4 } from 'uuid';

export const APIRoute = createAPIFileRoute('/api/fees/generate/$month')({
  POST: async ({ params }) => {
    try {
      const { month } = params;
      const students = sqlite.prepare("SELECT * FROM students WHERE status='ACTIVE'").all() as any[];
      const insert = sqlite.prepare(`
        INSERT OR IGNORE INTO fees(id, student_id, month, amount_due, amount_paid, payment_status)
        VALUES(?, ?, ?, ?, 0, 'UNPAID')
      `);
      sqlite.transaction(() => {
        for (const s of students) {
          insert.run(uuidv4(), s.id, month, s.monthly_fee);
        }
      })();
      return Response.json({ ok: true, generated: students.length });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
