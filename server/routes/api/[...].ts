import { defineEventHandler, readBody, getQuery, setResponseStatus } from 'h3';
import sqlite from '../../src/server/db';
import crypto from 'node:crypto';

function hashPin(pin: string) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

export default defineEventHandler(async (event) => {
  const url = new URL(event.node.req.url || '/', 'http://localhost');
  const pathname = url.pathname;
  const method = event.node.req.method || 'GET';

  // 1. GET /api/db/pull
  if (pathname === '/api/db/pull' && method === 'GET') {
    try {
      const students = sqlite.prepare('SELECT * FROM students ORDER BY name').all();
      const attendance = sqlite.prepare('SELECT * FROM attendance ORDER BY date DESC').all();
      const fees = sqlite.prepare('SELECT *, (amount_due - amount_paid) as balance_due FROM fees ORDER BY month DESC').all();
      const settings = sqlite.prepare('SELECT * FROM settings WHERE id=1').get();
      const beltLevels = sqlite.prepare('SELECT * FROM belt_levels ORDER BY rank').all();
      const whatsappLog = sqlite.prepare('SELECT * FROM whatsapp_log ORDER BY sent_at DESC').all();
      const users = sqlite.prepare('SELECT id, username, role, created_at FROM users').all();
      return { students, attendance, fees, settings, beltLevels, whatsappLog, users };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 2. POST /api/db/push
  if (pathname === '/api/db/push' && method === 'POST') {
    try {
      const body = await readBody(event);
      const { students = [], attendance = [], fees = [], settings } = body || {};

      sqlite.transaction(() => {
        if (settings) {
          sqlite.prepare(`
            UPDATE settings SET
              academy_name = @academy_name,
              address = @address,
              phone = @phone,
              whatsapp_number = @whatsapp_number,
              monthly_fee_default = @monthly_fee_default,
              fee_due_day = @fee_due_day,
              updated_at = datetime('now')
            WHERE id = 1
          `).run({
            academy_name: settings.academy_name || 'Dojo Master Academy',
            address: settings.address || '',
            phone: settings.phone || '',
            whatsapp_number: settings.whatsapp_number || '',
            monthly_fee_default: settings.monthly_fee_default || 1500,
            fee_due_day: settings.fee_due_day || 1,
          });
        }

        const upsertStudent = sqlite.prepare(`
          INSERT INTO students (id, name, dob, phone, parent_name, parent_phone, belt_level_id, monthly_fee, enrollment_date, status, notes, updated_at)
          VALUES (@id, @name, @dob, @phone, @parent_name, @parent_phone, @belt_level_id, @monthly_fee, @enrollment_date, @status, @notes, datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name, dob=excluded.dob, phone=excluded.phone, parent_name=excluded.parent_name,
            parent_phone=excluded.parent_phone, belt_level_id=excluded.belt_level_id, monthly_fee=excluded.monthly_fee,
            status=excluded.status, notes=excluded.notes, updated_at=datetime('now')
        `);
        for (const s of students) {
          upsertStudent.run({
            id: s.id,
            name: s.name,
            dob: s.dob || '',
            phone: s.phone || '',
            parent_name: s.parent_name || '',
            parent_phone: s.parent_phone || '',
            belt_level_id: s.belt_level_id || 1,
            monthly_fee: s.monthly_fee || 1500,
            enrollment_date: s.enrollment_date || '',
            status: s.status || 'ACTIVE',
            notes: s.notes || '',
          });
        }

        const upsertAtt = sqlite.prepare(`
          INSERT INTO attendance (id, student_id, date, status, notes, marked_at)
          VALUES (@id, @student_id, @date, @status, @notes, datetime('now'))
          ON CONFLICT(student_id, date) DO UPDATE SET
            status=excluded.status, notes=excluded.notes, marked_at=datetime('now')
        `);
        for (const a of attendance) {
          upsertAtt.run({
            id: a.id || crypto.randomUUID(),
            student_id: a.student_id,
            date: a.date,
            status: a.status,
            notes: a.notes || '',
          });
        }

        const upsertFee = sqlite.prepare(`
          INSERT INTO fees (id, student_id, month, amount_due, amount_paid, payment_status, payment_date, payment_mode, receipt_number, notes, updated_at)
          VALUES (@id, @student_id, @month, @amount_due, @amount_paid, @payment_status, @payment_date, @payment_mode, @receipt_number, @notes, datetime('now'))
          ON CONFLICT(student_id, month) DO UPDATE SET
            amount_due=excluded.amount_due, amount_paid=excluded.amount_paid, payment_status=excluded.payment_status,
            payment_date=excluded.payment_date, payment_mode=excluded.payment_mode, receipt_number=excluded.receipt_number,
            notes=excluded.notes, updated_at=datetime('now')
        `);
        for (const f of fees) {
          upsertFee.run({
            id: f.id || crypto.randomUUID(),
            student_id: f.student_id,
            month: f.month,
            amount_due: f.amount_due,
            amount_paid: f.amount_paid || 0,
            payment_status: f.payment_status || 'UNPAID',
            payment_date: f.payment_date || '',
            payment_mode: f.payment_mode || 'CASH',
            receipt_number: f.receipt_number || '',
            notes: f.notes || '',
          });
        }
      });

      return { success: true };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 3. POST /api/auth/login
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await readBody(event);
      const { username, pin } = body || {};
      if (!username || !pin) {
        setResponseStatus(event, 400);
        return { error: 'Username and PIN are required' };
      }

      const hashed = hashPin(String(pin));
      const user = sqlite.prepare('SELECT id, username, role FROM users WHERE username = @username AND pin = @pin').get({
        username,
        pin: hashed,
      }) as any;

      if (!user) {
        setResponseStatus(event, 401);
        return { error: 'Invalid username or PIN' };
      }

      return { success: true, user };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 4. POST /api/students
  if (pathname === '/api/students' && method === 'POST') {
    try {
      const body = await readBody(event);
      const {
        id = crypto.randomUUID(),
        name,
        dob = '',
        phone = '',
        parent_name = '',
        parent_phone,
        belt_level_id = 1,
        monthly_fee = 1500,
        enrollment_date = new Date().toISOString().slice(0, 10),
        status = 'ACTIVE',
        notes = '',
      } = body || {};

      if (!name || !parent_phone) {
        setResponseStatus(event, 400);
        return { error: 'Name and parent phone are required' };
      }

      sqlite.prepare(`
        INSERT INTO students (id, name, dob, phone, parent_name, parent_phone, belt_level_id, monthly_fee, enrollment_date, status, notes, updated_at)
        VALUES (@id, @name, @dob, @phone, @parent_name, @parent_phone, @belt_level_id, @monthly_fee, @enrollment_date, @status, @notes, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name, dob=excluded.dob, phone=excluded.phone, parent_name=excluded.parent_name,
          parent_phone=excluded.parent_phone, belt_level_id=excluded.belt_level_id, monthly_fee=excluded.monthly_fee,
          status=excluded.status, notes=excluded.notes, updated_at=datetime('now')
      `).run({
        id,
        name,
        dob,
        phone,
        parent_name,
        parent_phone,
        belt_level_id,
        monthly_fee,
        enrollment_date,
        status,
        notes,
      });

      const updated = sqlite.prepare('SELECT * FROM students WHERE id = @id').get({ id });
      return { success: true, student: updated };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 5. DELETE /api/students/:id
  if (pathname.startsWith('/api/students/') && method === 'DELETE') {
    try {
      const id = pathname.replace('/api/students/', '');
      sqlite.prepare("UPDATE students SET status = 'INACTIVE', updated_at = datetime('now') WHERE id = @id").run({ id });
      return { success: true, id };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 6. POST /api/attendance/bulk
  if (pathname === '/api/attendance/bulk' && method === 'POST') {
    try {
      const body = await readBody(event);
      const { date, records = [] } = body || {};
      if (!date || !Array.isArray(records)) {
        setResponseStatus(event, 400);
        return { error: 'Date and records array are required' };
      }

      sqlite.transaction(() => {
        const stmt = sqlite.prepare(`
          INSERT INTO attendance (id, student_id, date, status, notes, marked_at)
          VALUES (@id, @student_id, @date, @status, @notes, datetime('now'))
          ON CONFLICT(student_id, date) DO UPDATE SET
            status = excluded.status,
            notes = excluded.notes,
            marked_at = datetime('now')
        `);

        for (const rec of records) {
          stmt.run({
            id: rec.id || crypto.randomUUID(),
            student_id: rec.student_id,
            date,
            status: rec.status,
            notes: rec.notes || '',
          });
        }
      });

      return { success: true, count: records.length };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 7. GET /api/attendance/:date
  if (pathname.startsWith('/api/attendance/') && method === 'GET') {
    try {
      const date = pathname.replace('/api/attendance/', '');
      const records = sqlite.prepare(`
        SELECT a.*, s.name as student_name, s.belt_level_id
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date = @date
        ORDER BY s.name
      `).all({ date });
      return records;
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 8. POST /api/fees/generate/:month
  if (pathname.startsWith('/api/fees/generate/') && method === 'POST') {
    try {
      const month = pathname.replace('/api/fees/generate/', '');
      const activeStudents = sqlite.prepare("SELECT id, monthly_fee FROM students WHERE status = 'ACTIVE'").all() as any[];

      let generated = 0;
      sqlite.transaction(() => {
        const insertStmt = sqlite.prepare(`
          INSERT OR IGNORE INTO fees (id, student_id, month, amount_due, amount_paid, payment_status)
          VALUES (@id, @student_id, @month, @amount_due, 0, 'UNPAID')
        `);

        for (const s of activeStudents) {
          const res = insertStmt.run({
            id: crypto.randomUUID(),
            student_id: s.id,
            month,
            amount_due: s.monthly_fee || 1500,
          });
          if (res.changes > 0) generated++;
        }
      });

      return { success: true, generated };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 9. GET /api/fees/:month
  if (pathname.startsWith('/api/fees/') && pathname !== '/api/fees/pay' && method === 'GET') {
    try {
      const month = pathname.replace('/api/fees/', '');
      const records = sqlite.prepare(`
        SELECT f.*, (f.amount_due - f.amount_paid) as balance_due, s.name as student_name, s.parent_phone, s.belt_level_id
        FROM fees f
        JOIN students s ON f.student_id = s.id
        WHERE f.month = @month
        ORDER BY s.name
      `).all({ month });
      return records;
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 10. POST /api/fees/pay
  if (pathname === '/api/fees/pay' && method === 'POST') {
    try {
      const body = await readBody(event);
      const {
        id,
        student_id,
        month,
        amount_paid,
        payment_mode = 'CASH',
        notes = '',
        receipt_number,
      } = body || {};

      const existing = sqlite.prepare('SELECT * FROM fees WHERE (id = @id) OR (student_id = @student_id AND month = @month)').get({
        id: id || '',
        student_id: student_id || '',
        month: month || '',
      }) as any;

      if (!existing) {
        setResponseStatus(event, 404);
        return { error: 'Fee record not found' };
      }

      const totalPaid = (existing.amount_paid || 0) + Number(amount_paid);
      const amountDue = existing.amount_due;
      const paymentStatus = totalPaid >= amountDue ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';
      const paymentDate = new Date().toISOString().slice(0, 10);
      const receiptNo = receipt_number || `RCP-${month.replace('-', '')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

      sqlite.prepare(`
        UPDATE fees SET
          amount_paid = @amount_paid,
          payment_status = @payment_status,
          payment_date = @payment_date,
          payment_mode = @payment_mode,
          receipt_number = @receipt_number,
          notes = @notes,
          updated_at = datetime('now')
        WHERE id = @id
      `).run({
        id: existing.id,
        amount_paid: totalPaid,
        payment_status: paymentStatus,
        payment_date: paymentDate,
        payment_mode,
        receipt_number: receiptNo,
        notes,
      });

      const updated = sqlite.prepare('SELECT *, (amount_due - amount_paid) as balance_due FROM fees WHERE id = @id').get({ id: existing.id });
      return { success: true, fee: updated, receipt_number: receiptNo };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 11. GET /api/reports/attendance
  if (pathname === '/api/reports/attendance' && method === 'GET') {
    try {
      const query = getQuery(event);
      const month = String(query.month || new Date().toISOString().slice(0, 7));

      const dailyBreakdown = sqlite.prepare(`
        SELECT date,
          SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
          SUM(CASE WHEN status = 'ABSENT' THEN 1 ELSE 0 END) as absent,
          SUM(CASE WHEN status = 'LATE' THEN 1 ELSE 0 END) as late,
          SUM(CASE WHEN status = 'LEAVE' THEN 1 ELSE 0 END) as leave,
          COUNT(*) as total
        FROM attendance
        WHERE date LIKE @monthPattern
        GROUP BY date
        ORDER BY date ASC
      `).all({ monthPattern: `${month}%` });

      const studentRoster = sqlite.prepare(`
        SELECT s.id, s.name, s.parent_phone, b.name as belt_name, b.color_hex as belt_color,
          SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as present_days,
          SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_days,
          COUNT(a.id) as marked_days
        FROM students s
        LEFT JOIN belt_levels b ON s.belt_level_id = b.id
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date LIKE @monthPattern
        WHERE s.status = 'ACTIVE'
        GROUP BY s.id
        ORDER BY s.name ASC
      `).all({ monthPattern: `${month}%` });

      return { month, dailyBreakdown, studentRoster };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 12. GET /api/reports/fees
  if (pathname === '/api/reports/fees' && method === 'GET') {
    try {
      const query = getQuery(event);
      const month = String(query.month || new Date().toISOString().slice(0, 7));

      const summary = sqlite.prepare(`
        SELECT
          COUNT(*) as total_students,
          SUM(amount_due) as total_due,
          SUM(amount_paid) as total_collected,
          SUM(amount_due - amount_paid) as total_pending,
          SUM(CASE WHEN payment_status = 'PAID' THEN 1 ELSE 0 END) as count_paid,
          SUM(CASE WHEN payment_status = 'PARTIAL' THEN 1 ELSE 0 END) as count_partial,
          SUM(CASE WHEN payment_status = 'UNPAID' THEN 1 ELSE 0 END) as count_unpaid
        FROM fees
        WHERE month = @month
      `).get({ month }) as any;

      const beltDistribution = sqlite.prepare(`
        SELECT b.name as belt_name, b.color_hex as belt_color, COUNT(s.id) as student_count
        FROM belt_levels b
        LEFT JOIN students s ON s.belt_level_id = b.id AND s.status = 'ACTIVE'
        GROUP BY b.id
        ORDER BY b.rank ASC
      `).all();

      const pendingDues = sqlite.prepare(`
        SELECT f.*, (f.amount_due - f.amount_paid) as balance_due, s.name as student_name, s.parent_phone, b.name as belt_name
        FROM fees f
        JOIN students s ON f.student_id = s.id
        LEFT JOIN belt_levels b ON s.belt_level_id = b.id
        WHERE f.month = @month AND f.payment_status != 'PAID'
        ORDER BY (f.amount_due - f.amount_paid) DESC
      `).all({ month });

      return { month, summary, beltDistribution, pendingDues };
    } catch (err: any) {
      setResponseStatus(event, 500);
      return { error: err.message };
    }
  }

  // 13. POST /api/whatsapp/log & GET /api/whatsapp/log
  if (pathname === '/api/whatsapp/log') {
    if (method === 'POST') {
      try {
        const body = await readBody(event);
        const {
          id = crypto.randomUUID(),
          student_id = null,
          phone,
          message_type,
          message,
          status = 'SENT',
        } = body || {};

        sqlite.prepare(`
          INSERT INTO whatsapp_log (id, student_id, phone, message_type, message, status, sent_at)
          VALUES (@id, @student_id, @phone, @message_type, @message, @status, datetime('now'))
        `).run({ id, student_id, phone, message_type, message, status });

        return { success: true, id };
      } catch (err: any) {
        setResponseStatus(event, 500);
        return { error: err.message };
      }
    } else if (method === 'GET') {
      try {
        const logs = sqlite.prepare('SELECT * FROM whatsapp_log ORDER BY sent_at DESC LIMIT 100').all();
        return logs;
      } catch (err: any) {
        setResponseStatus(event, 500);
        return { error: err.message };
      }
    }
  }

  // Fallthrough for unmatched /api routes
  setResponseStatus(event, 404);
  return { error: `Endpoint ${method} ${pathname} not found` };
});
