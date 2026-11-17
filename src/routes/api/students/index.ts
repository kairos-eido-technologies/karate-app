import { createAPIFileRoute } from '@tanstack/start/api';
import sqlite from '../../../server/db';
import { v4 as uuidv4 } from 'uuid';

export const APIRoute = createAPIFileRoute('/api/students')({
  POST: async ({ request }) => {
    try {
      const data = await request.json();
      const id = data.id || uuidv4();
      if (data.id) {
        sqlite.prepare(`
          UPDATE students
          SET name=@name, dob=@dob, phone=@phone, parent_name=@parent_name, parent_phone=@parent_phone,
              belt_level_id=@belt_level_id, monthly_fee=@monthly_fee, enrollment_date=@enrollment_date,
              status=@status, notes=@notes, updated_at=datetime('now')
          WHERE id=@id
        `).run({ ...data, id });
      } else {
        sqlite.prepare(`
          INSERT INTO students(id, name, dob, phone, parent_name, parent_phone, belt_level_id, monthly_fee, enrollment_date, status, notes)
          VALUES(@id, @name, @dob, @phone, @parent_name, @parent_phone, @belt_level_id, @monthly_fee, @enrollment_date, @status, @notes)
        `).run({ ...data, id, status: data.status || 'ACTIVE' });
      }
      const student = sqlite.prepare('SELECT * FROM students WHERE id=?').get(id);
      return Response.json({ student });
    } catch (err: any) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  },
});
