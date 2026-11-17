import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/fees/$month')({
  GET: async ({ params }) => {
    try {
      const { month } = params;
      const records = sqlite.prepare(`
        SELECT f.*, s.name as student_name, s.parent_phone, (f.amount_due - f.amount_paid) as balance_due
        FROM fees f
        JOIN students s ON f.student_id = s.id
        WHERE f.month=?
      `).all(month);
      return Response.json({ records });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
