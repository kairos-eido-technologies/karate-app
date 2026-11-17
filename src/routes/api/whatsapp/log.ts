import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';
import { v4 as uuidv4 } from 'uuid';

export const APIRoute = createAPIFileRoute('/api/whatsapp/log')({
  POST: async ({ request }) => {
    try {
      const { student_id, phone, message_type, message, status } = await request.json();
      const id = uuidv4();
      sqlite.prepare(`
        INSERT INTO whatsapp_log(id, student_id, phone, message_type, message, status, sent_at)
        VALUES(?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(id, student_id || null, phone, message_type || 'CUSTOM', message, status || 'SENT');
      return Response.json({ ok: true, id });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
  GET: async () => {
    try {
      const logs = sqlite.prepare(`
        SELECT w.*, s.name as student_name
        FROM whatsapp_log w
        LEFT JOIN students s ON w.student_id = s.id
        ORDER BY w.sent_at DESC
        LIMIT 100
      `).all();
      return Response.json({ logs });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
