// Відповідає за імпорт довідника працівників із Google Sheets у MySQL employees.
import { google } from 'googleapis';
import { config } from '../config.js';
import { withTransaction } from '../db.js';
import { toMysqlDateTime } from '../utils/time.js';

export async function syncEmployeesFromGoogleSheet() {
  validateGoogleConfig();

  const startedAt = new Date();

  return withTransaction(async (connection) => {
    const syncLogId = await startSyncLog(connection, 'EMPLOYEES_IMPORT');

    try {
      const rows = await readEmployeesSheet();
      const employees = parseEmployees(rows);
      let imported = 0;

      for (const employee of employees) {
        await upsertEmployee(connection, employee);
        imported += 1;
      }

      const message = `Синхронізацію завершено. Імпортовано або оновлено ${imported} працівників.`;
      await finishSyncLog(connection, syncLogId, 'SUCCESS', message);

      return {
        ok: true,
        imported,
        skipped: Math.max(0, rows.length - employees.length),
        message,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString()
      };
    } catch (error) {
      await finishSyncLog(connection, syncLogId, 'FAILED', error.message);
      throw error;
    }
  });
}

function validateGoogleConfig() {
  if (!config.google.employeesSheetId) {
    throw new Error('GOOGLE_EMPLOYEES_SHEET_ID не налаштовано');
  }

  if (!config.google.serviceAccountEmail) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL не налаштовано');
  }

  if (!config.google.privateKey) {
    throw new Error('GOOGLE_PRIVATE_KEY не налаштовано');
  }
}

async function readEmployeesSheet() {
  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.employeesSheetId,
    range: config.google.employeesSheetRange
  });

  return response.data.values || [];
}

function parseEmployees(rows) {
  return rows
    .filter((row, index) => {
      if (!row || !row[0]) return false;
      if (index === 0 && isHeaderRow(row)) return false;
      return true;
    })
    .map((row) => ({
      externalCode: String(row[0] || '').trim(),
      fullName: String(row[1] || '').trim(),
      department: String(row[2] || '').trim() || null,
      position: String(row[3] || '').trim() || null,
      isActive: parseIsActive(row[4])
    }))
    .filter((employee) => employee.externalCode && employee.fullName);
}

function isHeaderRow(row) {
  const firstCell = String(row[0] || '').trim().toLowerCase();
  return ['external_code', 'code', 'uid', 'id', 'код'].includes(firstCell);
}

function parseIsActive(value) {
  const normalized = String(value ?? '1').trim().toLowerCase();

  if (['0', 'false', 'no', 'ні', 'нi', 'inactive', 'disabled', 'деактивовано'].includes(normalized)) {
    return 0;
  }

  return 1;
}

async function upsertEmployee(connection, employee) {
  await connection.execute(
    `INSERT INTO employees
      (external_code, full_name, department, position, is_active, source_updated_at)
     VALUES
      (:externalCode, :fullName, :department, :position, :isActive, :sourceUpdatedAt)
     ON DUPLICATE KEY UPDATE
       full_name = VALUES(full_name),
       department = VALUES(department),
       position = VALUES(position),
       is_active = VALUES(is_active),
       source_updated_at = VALUES(source_updated_at)`,
    {
      externalCode: employee.externalCode,
      fullName: employee.fullName,
      department: employee.department,
      position: employee.position,
      isActive: employee.isActive,
      sourceUpdatedAt: toMysqlDateTime(new Date())
    }
  );
}

async function startSyncLog(connection, type) {
  const [result] = await connection.execute(
    `INSERT INTO sync_log (type, status)
     VALUES (:type, 'STARTED')`,
    { type }
  );

  return result.insertId;
}

async function finishSyncLog(connection, id, status, message) {
  await connection.execute(
    `UPDATE sync_log
     SET status = :status,
         finished_at = :finishedAt,
         message = :message
     WHERE id = :id`,
    {
      id,
      status,
      finishedAt: toMysqlDateTime(new Date()),
      message: String(message || '').slice(0, 1000)
    }
  );
}
