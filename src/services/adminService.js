// Відповідає за дані адмінської панелі: поточний стан працівників, відкриті зміни та ознаки забутого завершення.
import { config } from '../config.js';
import { pool } from '../db.js';
import { diffMinutes } from '../utils/time.js';

export async function getAdminStatus() {
  const [rows] = await pool.execute(
    `SELECT
       e.id AS employee_id,
       e.external_code,
       e.full_name,
       e.department,
       e.position,
       e.is_active,
       wl.id AS work_log_id,
       wl.start_time,
       wl.status
     FROM employees e
     LEFT JOIN work_log wl
       ON wl.employee_id = e.id
      AND wl.status = 'OPEN'
      AND wl.end_time IS NULL
     WHERE e.is_active = 1
     ORDER BY
       CASE WHEN wl.id IS NULL THEN 1 ELSE 0 END,
       wl.start_time ASC,
       e.full_name ASC`
  );

  const now = new Date();
  const employees = rows.map((row) => {
    const onShift = Boolean(row.work_log_id);
    const startedAt = row.start_time ? normalizeDate(row.start_time) : null;
    const minutesOnShift = startedAt ? diffMinutes(startedAt, now) : 0;
    const forgotToClose = onShift && minutesOnShift > config.overtimeHours * 60;

    return {
      employeeId: row.employee_id,
      externalCode: row.external_code,
      fullName: row.full_name,
      department: row.department,
      position: row.position,
      onShift,
      workLogId: row.work_log_id,
      startedAt: startedAt ? startedAt.toISOString() : null,
      minutesOnShift,
      forgotToClose,
      status: onShift ? (forgotToClose ? 'FORGOT_TO_CLOSE' : 'ON_SHIFT') : 'OFF_SHIFT'
    };
  });

  return {
    ok: true,
    generatedAt: now.toISOString(),
    summary: {
      totalActive: employees.length,
      onShift: employees.filter((employee) => employee.onShift).length,
      offShift: employees.filter((employee) => !employee.onShift).length,
      forgotToClose: employees.filter((employee) => employee.forgotToClose).length
    },
    employees
  };
}

function normalizeDate(value) {
  return value instanceof Date ? value : new Date(value);
}
