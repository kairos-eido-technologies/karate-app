import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';
import { v4 as uuidv4 } from 'uuid';

export const APIRoute = createAPIFileRoute('/api/fees/pay')({
  POST: async ({ request }) => {
    try {
      const { student_id, month, amount_paid, payment_mode, notes } = await request.json();
      
      let fee = sqlite.prepare('SELECT * FROM fees WHERE student_id=? AND month=?').get(student_id, month) as any;
      if (!fee) {
        const student = sqlite.prepare('SELECT monthly_fee FROM students WHERE id=?').get(student_id) as any;
        const feeId = uuidv4();
        sqlite.prepare(`
          INSERT INTO fees(id, student_id, month, amount_due, amount_paid, payment_status)
          VALUES(?, ?, ?, ?, 0, 'UNPAID')
        `).run(feeId, student_id, month, student?.monthly_fee || 1500);
        fee = sqlite.prepare('SELECT * FROM fees WHERE id=?').get(feeId) as any;
      }
      
      const count = (sqlite.prepare('SELECT COUNT(*) as cnt FROM fees WHERE receipt_number IS NOT NULL').get() as any).cnt + 1;
      const receipt_number = `RCP-${new Date().getFullYear()}-${String(count).padStart(4, '0')}`;
      
      const paid = (fee.amount_paid || 0) + Number(amount_paid);
      const status = paid >= fee.amount_due ? 'PAID' : paid > 0 ? 'PARTIAL' : 'UNPAID';
      
      sqlite.prepare(`
        UPDATE fees
        SET amount_paid=?, payment_status=?, payment_date=date('now'), payment_mode=?, receipt_number=?, notes=?, updated_at=datetime('now')
        WHERE id=?
      `).run(paid, status, payment_mode, receipt_number, notes || '', fee.id);
      
      const updated = sqlite.prepare('SELECT *, (amount_due - amount_paid) as balance_due FROM fees WHERE id=?').get(fee.id);
      return Response.json({ fee: updated, receipt_number });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
