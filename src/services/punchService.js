// Відповідає за головну бізнес-логіку однієї кнопки: перевірка працівника, старт або завершення зміни в MySQL-транзакції.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { withTransaction } from '../db.js';
import { diffMinutes, formatWorkedTime, toMysqlDateTime } from '../utils/time.js';

export async function punch({ employeeCode, terminalId, requestId }) {
  const normalizedCode = String(employeeCode || '').trim();
  const normalizedTerminalId = String(terminalId || 'unknown-terminal').trim();
  const normalizedRequestId = String(requestId || crypto.randomUUID()).trim();

  if (!normalizedCode) {
    return {
      ok: false,
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
      action: 'END',
      employeeName: employee.full_name,
      durationMinutes,
      message
    };
  });
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
