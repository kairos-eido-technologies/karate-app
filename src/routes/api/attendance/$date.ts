import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/attendance/$date')({
  GET: async ({ params }) => {
    try {
      const { date } = params;
      const records = sqlite.prepare('SELECT * FROM attendance WHERE date=?').all(date);
      return Response.json({ records });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
