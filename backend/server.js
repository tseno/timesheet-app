const fastify = require('fastify')({ logger: true });
const db = require('./database');

fastify.register(require('@fastify/cors'), {
  origin: ['http://localhost:3000']
});

function calculateTotalHours(startTime, endTime, breakTime = 0) {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(`2000-01-01T${startTime}`);
  const end = new Date(`2000-01-01T${endTime}`);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.max(0, diffHours - (breakTime / 60));
}

fastify.get('/api/timesheets/:date', async (request, reply) => {
  const { date } = request.params;
  
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM timesheets WHERE date = ? ORDER BY updated_at DESC LIMIT 1', [date], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || {
          date,
          start_time: '',
          end_time: '',
          break_time: 0,
          work_content: '',
          total_hours: 0
        });
      }
    });
  });
});

fastify.post('/api/timesheets', async (request, reply) => {
  const { date, start_time, end_time, break_time, work_content } = request.body;
  const total_hours = calculateTotalHours(start_time, end_time, break_time);
  
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO timesheets 
      (date, start_time, end_time, break_time, work_content, total_hours, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(date) DO UPDATE SET 
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        break_time = excluded.break_time,
        work_content = excluded.work_content,
        total_hours = excluded.total_hours,
        updated_at = CURRENT_TIMESTAMP`,
      [date, start_time, end_time, break_time, work_content, total_hours],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, total_hours });
        }
      }
    );
  });
});

fastify.get('/api/timesheets', async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT DISTINCT substr(date, 1, 7) as month 
            FROM timesheets 
            ORDER BY month DESC`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

// 月次勤務表のステータス取得
fastify.get('/api/timesheets/status/:yearMonth', async (request, reply) => {
  const { yearMonth } = request.params;
  const [year, month] = yearMonth.split('-').map(Number);
  
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM monthly_timesheet_status WHERE year = ? AND month = ?', 
      [year, month], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {
            year,
            month,
            status: 'draft',
            rejection_reason: null
          });
        }
      });
  });
});

// 月次勤務表のステータス更新
fastify.post('/api/timesheets/status', async (request, reply) => {
  const { year, month, status, rejection_reason } = request.body;
  
  return new Promise((resolve, reject) => {
    db.run(`INSERT OR REPLACE INTO monthly_timesheet_status 
      (year, month, status, rejection_reason, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [year, month, status, rejection_reason || null],
      function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ success: true, id: this.lastID });
        }
      }
    );
  });
});

// 全月のステータス付き一覧取得
fastify.get('/api/timesheets/months-with-status', async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT 
              substr(t.date, 1, 7) as month,
              COALESCE(s.status, 'draft') as status
            FROM timesheets t
            LEFT JOIN monthly_timesheet_status s ON 
              substr(t.date, 1, 4) = s.year AND 
              substr(t.date, 6, 2) = printf('%02d', s.month)
            GROUP BY substr(t.date, 1, 7), s.status
            ORDER BY month DESC`, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
});

const start = async () => {
  try {
    await fastify.listen({ port: 8000, host: '0.0.0.0' });
    console.log('Server running on http://localhost:8000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();