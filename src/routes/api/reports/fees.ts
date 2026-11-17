import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/reports/fees')({
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url);
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);

      const summary = sqlite.prepare(`
        SELECT 
          COUNT(*) as total_records,
          COALESCE(SUM(amount_due), 0) as total_due,
          COALESCE(SUM(amount_paid), 0) as total_paid,
          COALESCE(SUM(amount_due - amount_paid), 0) as total_pending,
          COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paid_count,
          COUNT(CASE WHEN payment_status = 'UNPAID' THEN 1 END) as unpaid_count,
          COUNT(CASE WHEN payment_status = 'PARTIAL' THEN 1 END) as partial_count
        FROM fees
        WHERE month = ?
      `).get(month) as any;

      const breakdown = sqlite.prepare(`
        SELECT 
          f.*, s.name as student_name, s.parent_name, s.parent_phone, b.name as belt_name,
          (f.amount_due - f.amount_paid) as balance_due
        FROM fees f
        JOIN students s ON f.student_id = s.id
        LEFT JOIN belt_levels b ON s.belt_level_id = b.id
        WHERE f.month = ?
        ORDER BY s.name ASC
      `).all(month);

      return Response.json({ summary, records: breakdown, month });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
