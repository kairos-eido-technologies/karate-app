import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/students/$id')({
  DELETE: async ({ params }) => {
    try {
      const { id } = params;
      sqlite.prepare("UPDATE students SET status='INACTIVE', updated_at=datetime('now') WHERE id=?").run(id);
      return Response.json({ ok: true });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
