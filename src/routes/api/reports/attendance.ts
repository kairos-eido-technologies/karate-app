import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/reports/attendance')({
  GET: async ({ request }) => {
    try {
      const url = new URL(request.url);
      const start = url.searchParams.get('start') || new Date().toISOString().slice(0, 7) + '-01';
      const end = url.searchParams.get('end') || new Date().toISOString().slice(0, 10);
      
      const rows = sqlite.prepare(`
        SELECT 
          s.id, s.name, s.belt_level_id, b.name as belt_name,
          COUNT(CASE WHEN a.status = 'PRESENT' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'ABSENT' THEN 1 END) as absent_count,
          COUNT(CASE WHEN a.status = 'LATE' THEN 1 END) as late_count,
          COUNT(CASE WHEN a.status = 'LEAVE' THEN 1 END) as leave_count,
          COUNT(a.id) as total_sessions
        FROM students s
        LEFT JOIN belt_levels b ON s.belt_level_id = b.id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date >= ? AND a.date <= ?
        WHERE s.status = 'ACTIVE'
        GROUP BY s.id
        ORDER BY s.name ASC
      `).all(start, end);

      return Response.json({ records: rows, start, end });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
