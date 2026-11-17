import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/db/pull')({
  GET: async () => {
    try {
      const students = sqlite.prepare('SELECT * FROM students ORDER BY name').all();
      const attendance = sqlite.prepare('SELECT * FROM attendance ORDER BY date DESC').all();
      const fees = sqlite.prepare('SELECT *, (amount_due - amount_paid) as balance_due FROM fees ORDER BY month DESC').all();
      const settings = sqlite.prepare('SELECT * FROM settings WHERE id=1').get();
      const beltLevels = sqlite.prepare('SELECT * FROM belt_levels ORDER BY rank').all();
      const whatsappLog = sqlite.prepare('SELECT * FROM whatsapp_log ORDER BY sent_at DESC').all();
      const users = sqlite.prepare('SELECT id, username, role, created_at FROM users').all();
      return Response.json({ students, attendance, fees, settings, beltLevels, whatsappLog, users });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
