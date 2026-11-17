import { spawn } from 'node:child_process';
import http from 'node:http';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TEST_PORT = 3050;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function run() {
  console.log('--- Starting Dojo Manager Nitro Server on port ' + TEST_PORT + ' ---');
  const server = spawn('node', ['.output/server/index.mjs'], {
    env: { ...process.env, HOST: '127.0.0.1', NITRO_HOST: '127.0.0.1', PORT: String(TEST_PORT), NITRO_PORT: String(TEST_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', d => console.log('[Server stdout]', d.toString().trim()));
  server.stderr.on('data', d => console.error('[Server stderr]', d.toString().trim()));

  let ready = false;
  for (let i = 0; i < 20; i++) {
    await wait(500);
    try {
      const res = await request('GET', '/api/db/pull');
      if (res.status === 200) {
        ready = true;
        console.log('✓ Server is responsive on /api/db/pull!');
        break;
      } else {
        console.log('Got non-200 response:', res.status, res.body);
      }
    } catch (e) {
      console.log('Poll failed:', e.message);
    }
  }

  if (!ready) {
    server.kill();
    throw new Error('Server did not start in time');
  }

  try {
    // 1. Pull initial DB state
    console.log('\n[Test 1] GET /api/db/pull');
    const pullRes = await request('GET', '/api/db/pull');
    console.log('Status:', pullRes.status);
    const dbData = JSON.parse(pullRes.body);
    console.log('Initial Students:', dbData.students.length);
    console.log('Belt Levels:', dbData.beltLevels.length);
    console.log('Settings:', dbData.settings?.academy_name);

    // 2. Auth Login
    console.log('\n[Test 2] POST /api/auth/login');
    const loginRes = await request('POST', '/api/auth/login', { username: 'admin', pin: '123456' });
    console.log('Status:', loginRes.status, 'Body:', loginRes.body);
    if (loginRes.status !== 200) throw new Error('Login failed: ' + loginRes.body);

    // 3. Create Student
    console.log('\n[Test 3] POST /api/students');
    const studentPayload = {
      id: 'test-student-1',
      name: 'Ryu Hoshi',
      dob: '2010-07-21',
      phone: '9876543210',
      parent_name: 'Gouken',
      parent_phone: '919876543210',
      belt_level_id: 1, // White belt
      monthly_fee: 1500,
      enrollment_date: '2026-11-01',
      status: 'ACTIVE',
      notes: 'Strong spirit and dedication',
    };
    const addStudentRes = await request('POST', '/api/students', studentPayload);
    console.log('Status:', addStudentRes.status, 'Body:', addStudentRes.body);
    if (addStudentRes.status !== 200) throw new Error('Add student failed: ' + addStudentRes.body);

    // 4. Mark Attendance
    console.log('\n[Test 4] POST /api/attendance/bulk');
    const attPayload = {
      date: '2026-11-15',
      records: [{ student_id: 'test-student-1', status: 'PRESENT', notes: 'First session' }],
    };
    const attRes = await request('POST', '/api/attendance/bulk', attPayload);
    console.log('Status:', attRes.status, 'Body:', attRes.body);
    if (attRes.status !== 200) throw new Error('Attendance bulk mark failed: ' + attRes.body);

    // 5. Query Attendance for Date
    console.log('\n[Test 5] GET /api/attendance/2026-11-15');
    const getAttRes = await request('GET', '/api/attendance/2026-11-15');
    console.log('Status:', getAttRes.status, 'Records found:', JSON.parse(getAttRes.body).length);
    if (getAttRes.status !== 200) throw new Error('Get attendance failed: ' + getAttRes.body);

    // 6. Generate Monthly Fees
    console.log('\n[Test 6] POST /api/fees/generate/2026-11');
    const genFeeRes = await request('POST', '/api/fees/generate/2026-11');
    console.log('Status:', genFeeRes.status, 'Body:', genFeeRes.body);
    if (genFeeRes.status !== 200) throw new Error('Generate fees failed: ' + genFeeRes.body);

    // 7. Get Monthly Fees
    console.log('\n[Test 7] GET /api/fees/2026-11');
    const getFeeRes = await request('GET', '/api/fees/2026-11');
    const feeRecords = JSON.parse(getFeeRes.body);
    console.log('Status:', getFeeRes.status, 'Fee records count:', feeRecords.length);
    if (getFeeRes.status !== 200) throw new Error('Get fees failed: ' + getFeeRes.body);
    const feeId = feeRecords[0]?.id;

    // 8. Record Fee Payment
    if (feeId) {
      console.log('\n[Test 8] POST /api/fees/pay');
      const payRes = await request('POST', '/api/fees/pay', {
        id: feeId,
        student_id: 'test-student-1',
        month: '2026-11',
        amount_paid: 1500,
        payment_mode: 'UPI',
        receipt_number: 'RCP-2026-0001',
        notes: 'Full payment via GPay',
      });
      console.log('Status:', payRes.status, 'Body:', payRes.body);
      if (payRes.status !== 200) throw new Error('Fee payment failed: ' + payRes.body);
    }

    // 9. Reports
    console.log('\n[Test 9] GET /api/reports/attendance & /api/reports/fees');
    const repAtt = await request('GET', '/api/reports/attendance?month=2026-11');
    const repFees = await request('GET', '/api/reports/fees?month=2026-11');
    console.log('Reports Attendance Status:', repAtt.status, 'Body:', JSON.parse(repAtt.body).dailyBreakdown.length, 'days');
    console.log('Reports Fees Status:', repFees.status, 'Summary total_due:', JSON.parse(repFees.body).summary?.total_due);
    if (repAtt.status !== 200 || repFees.status !== 200) throw new Error('Reports failed');

    // 10. WhatsApp Log
    console.log('\n[Test 10] POST /api/whatsapp/log');
    const waRes = await request('POST', '/api/whatsapp/log', {
      student_id: 'test-student-1',
      phone: '919876543210',
      message_type: 'RECEIPT',
      message: 'Receipt RCP-2026-0001 for Ryu Hoshi',
      status: 'SENT',
    });
    console.log('Status:', waRes.status, 'Body:', waRes.body);
    if (waRes.status !== 200) throw new Error('WhatsApp log failed: ' + waRes.body);

    // 11. HTML Root Page
    console.log('\n[Test 11] GET / (Root HTML check)');
    const rootRes = await request('GET', '/');
    console.log('Status:', rootRes.status, 'HTML content length:', rootRes.body.length);

    console.log('\n========================================');
    console.log('ALL API & SMOKE TESTS PASSED SUCCESSFULLY!');
    console.log('========================================\n');
  } finally {
    server.kill();
  }
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
