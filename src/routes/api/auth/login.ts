import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';

export const APIRoute = createAPIFileRoute('/api/auth/login')({
  POST: async ({ request }) => {
    try {
      const { username, pin } = await request.json();
      const user = sqlite.prepare('SELECT * FROM users WHERE username=? AND pin=?').get(username, pin) as any;
      if (!user) {
        return Response.json({ error: 'Invalid PIN or username' }, { status: 401 });
      }
      return Response.json({
        user: { id: user.id, username: user.username, role: user.role },
        token: `tok_${user.id}_${Date.now()}`,
      });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
