import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';
import { v4 as uuidv4 } from 'uuid';

export const APIRoute = createAPIFileRoute('/api/attendance/bulk')({
  POST: async ({ request }) => {
    try {
      const { date, records } = await request.json();
      const upsert = sqlite.prepare(`
        INSERT OR REPLACE INTO attendance(id, student_id, date, status, notes, marked_at)
        VALUES(@id, @student_id, @date, @status, @notes, datetime('now'))
      `);
      const bulkUpsert = sqlite.transaction((recs: any[]) => {
        for (const r of recs) {
          upsert.run(r);
        }
      });
      const toSave = records.map((r: any) => ({
        id: r.id || uuidv4(),
        student_id: r.student_id,
        date,
        status: r.status,
        notes: r.notes || '',
      }));
      bulkUpsert(toSave);
      return Response.json({ ok: true, count: toSave.length });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
