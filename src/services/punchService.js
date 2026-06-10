// Відповідає за бізнес-логіку скану і підтвердженої дії: перевірка працівника, показ дозволеної кнопки, старт або завершення зміни в MySQL-транзакції.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { diffMinutes, formatWorkedTime, toMysqlDateTime } from '../utils/time.js';

export async function scanPunch({ employeeCode }) {
  const normalizedCode = normalizeCode(employeeCode);

  if (!normalizedCode) {
    return {
      ok: false,
      decision: 'DENY',
      action: null,
      buttonText: null,
      message: 'Скануйте код працівника'
    };
  }

  const [employees] = await pool.execute(
    `SELECT id, external_code, full_name, is_active
     FROM employees
     WHERE external_code = :externalCode
     LIMIT 1`,
    { externalCode: normalizedCode }
  );

  const employee = employees[0];

  if (!employee || !employee.is_active) {
    return {
      ok: false,
      decision: 'DENY',
      action: null,
      buttonText: null,
      message: 'Працівника не знайдено або деактивовано'
    };
  }

  const [openRows] = await pool.execute(
    `SELECT id, start_time
     FROM work_log
     WHERE employee_id = :employeeId
       AND status = 'OPEN'
       AND end_time IS NULL
     ORDER BY start_time DESC
     LIMIT 1`,
    { employeeId: employee.id }
  );

  const openShift = openRows[0];

  if (!openShift) {
    return {
      ok: true,
      decision: 'ALLOW',
      action: 'START',
      buttonText: 'ПОЧАТИ ЗМІНУ',
      employeeName: employee.full_name,
      message: `${employee.full_name}: можна розпочати зміну`
    };
  }

  const startTime = openShift.start_time instanceof Date
    ? openShift.start_time
    : new Date(openShift.start_time);
  const durationMinutes = diffMinutes(startTime, new Date());

  return {
    ok: true,
    decision: 'ALLOW',
    action: 'END',
    buttonText: 'ЗАКІНЧИТИ ЗМІНУ',
    employeeName: employee.full_name,
    durationMinutes,
    message: `${employee.full_name}: зміна триває ${formatWorkedTime(durationMinutes)}`
  };
}

export async function punch({ employeeCode, terminalId, requestId, expectedAction }) {
  const normalizedCode = normalizeCode(employeeCode);
  const normalizedTerminalId = String(terminalId || 'unknown-terminal').trim();
  const normalizedRequestId = String(requestId || crypto.randomUUID()).trim();
  const normalizedExpectedAction = String(expectedAction || '').trim().toUpperCase();

  if (!normalizedCode) {
    return {
      ok: false,
      decision: 'DENY',
      action: 'REJECTED',
      message: 'Скануйте код працівника'
    };
  }

  return withTransaction(async (connection) => {
    const [employees] = await connection.execute(
      `SELECT id, external_code, full_name, is_active
       FROM employees
       WHERE external_code = :externalCode
       LIMIT 1
       FOR UPDATE`,
      { externalCode: normalizedCode }
    );

    const employee = employees[0];

    if (!employee || !employee.is_active) {
      await insertPunchEvent(connection, {
        employeeCode: normalizedCode,
        employeeId: employee?.id || null,
        eventType: 'REJECTED',
        terminalId: normalizedTerminalId,
        requestId: normalizedRequestId,
        result: 'ERROR',
        message: 'Працівника не знайдено або деактивовано'
      });

      return {
        ok: false,
        decision: 'DENY',
        action: 'REJECTED',
        message: 'Працівника не знайдено або деактивовано'
      };
    }

    const [openRows] = await connection.execute(
      `SELECT id, start_time
       FROM work_log
       WHERE employee_id = :employeeId
         AND status = 'OPEN'
         AND end_time IS NULL
       ORDER BY start_time DESC
       LIMIT 1
       FOR UPDATE`,
      { employeeId: employee.id }
    );

    const now = new Date();
    const nowSql = toMysqlDateTime(now);
    const openShift = openRows[0];
    const actualAction = openShift ? 'END' : 'START';

    if (normalizedExpectedAction && normalizedExpectedAction !== actualAction) {
      const message = 'Стан зміни змінився. Скануйте код ще раз';

      await insertPunchEvent(connection, {
        employeeCode: normalizedCode,
        employeeId: employee.id,
        eventType: 'REJECTED',
        terminalId: normalizedTerminalId,
        requestId: normalizedRequestId,
        result: 'ERROR',
        message
      });

      return {
        ok: false,
        decision: 'DENY',
        action: 'REJECTED',
        message
      };
    }

    if (!openShift) {
      await connection.execute(
        `INSERT INTO work_log
          (employee_id, start_time, status, terminal_start_id)
         VALUES
          (:employeeId, :startTime, 'OPEN', :terminalId)`,
        {
          employeeId: employee.id,
          startTime: nowSql,
          terminalId: normalizedTerminalId
        }
      );

      const message = `${employee.full_name}, зміну розпочато`;

      await insertPunchEvent(connection, {
        employeeCode: normalizedCode,
        employeeId: employee.id,
        eventType: 'START',
        terminalId: normalizedTerminalId,
        requestId: normalizedRequestId,
        result: 'OK',
        message
      });

      return {
        ok: true,
        decision: 'DONE',
        action: 'START',
        employeeName: employee.full_name,
        message
      };
    }

    const startTime = openShift.start_time instanceof Date
      ? openShift.start_time
      : new Date(openShift.start_time);
    const durationMinutes = diffMinutes(startTime, now);
    const status = durationMinutes > config.overtimeHours * 60 ? 'OVERTIME' : 'CLOSED';

    await connection.execute(
      `UPDATE work_log
       SET end_time = :endTime,
           duration_minutes = :durationMinutes,
           status = :status,
           terminal_end_id = :terminalId
       WHERE id = :workLogId`,
      {
        endTime: nowSql,
        durationMinutes,
        status,
        terminalId: normalizedTerminalId,
        workLogId: openShift.id
      }
    );

    const message = `${employee.full_name}, відпрацьовано ${formatWorkedTime(durationMinutes)}`;

    await insertPunchEvent(connection, {
      employeeCode: normalizedCode,
      employeeId: employee.id,
      eventType: 'END',
      terminalId: normalizedTerminalId,
      requestId: normalizedRequestId,
      result: 'OK',
      message
    });

    return {
      ok: true,
      decision: 'DONE',
      action: 'END',
      employeeName: employee.full_name,
      durationMinutes,
      message
    };
  });
}

function normalizeCode(employeeCode) {
  return String(employeeCode || '').trim();
}

async function insertPunchEvent(connection, event) {
  await connection.execute(
    `INSERT INTO punch_events
      (employee_code, employee_id, event_type, terminal_id, request_id, result, message)
     VALUES
      (:employeeCode, :employeeId, :eventType, :terminalId, :requestId, :result, :message)`,
    event
  );
}
