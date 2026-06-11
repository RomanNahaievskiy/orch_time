// Відповідає за експорт завершених записів із MySQL work_log у Google Sheet "Журнал ОРЧ".
import { google } from 'googleapis';
import { config } from '../config.js';
import { pool, withTransaction } from '../db.js';
import { toMysqlDateTime } from '../utils/time.js';

export async function exportWorkLogToGoogleSheet() {
  validateGoogleConfig();

  const startedAt = new Date();
  const rows = await getRowsForExport();

  if (rows.length === 0) {
    return {
      ok: true,
      exported: 0,
      message: 'Немає нових завершених записів для експорту.',
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString()
    };
  }

  const values = rows.map(formatWorkLogRow);
  await appendRowsToSheet(values);

  return withTransaction(async (connection) => {
    const syncLogId = await startSyncLog(connection, 'WORK_LOG_EXPORT');

    try {
      await markRowsAsExported(connection, rows.map((row) => row.id));

      const message = `Експорт завершено. Додано ${rows.length} записів у Google Sheet.`;
      await finishSyncLog(connection, syncLogId, 'SUCCESS', message);

      return {
        ok: true,
        exported: rows.length,
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
  if (!config.google.workLogSheetId) {
    throw new Error('GOOGLE_WORK_LOG_SHEET_ID не налаштовано');
  }

  if (!config.google.serviceAccountEmail) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL не налаштовано');
  }

  if (!config.google.privateKey) {
    throw new Error('GOOGLE_PRIVATE_KEY не налаштовано');
  }
}

async function getRowsForExport() {
  const [rows] = await pool.execute(
    `SELECT
       wl.id,
       e.external_code,
       e.full_name,
       wl.start_time,
       wl.end_time,
       wl.duration_minutes,
       wl.status
     FROM work_log wl
     JOIN employees e ON e.id = wl.employee_id
     WHERE wl.end_time IS NOT NULL
       AND wl.status IN ('CLOSED', 'OVERTIME')
       AND wl.exported_to_sheet_at IS NULL
     ORDER BY wl.start_time ASC, wl.id ASC`
  );

  return rows;
}

function formatWorkLogRow(row) {
  const exportedAt = new Date();

  return [
    row.id,
    row.external_code,
    row.full_name,
    formatSheetDate(row.start_time),
    formatSheetDate(row.end_time),
    row.duration_minutes,
    row.status,
    formatSheetDate(exportedAt)
  ];
}

function formatSheetDate(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

async function appendRowsToSheet(values) {
  const auth = new google.auth.JWT({
    email: config.google.serviceAccountEmail,
    key: config.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.google.workLogSheetId,
    range: config.google.workLogSheetRange,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values
    }
  });
}

async function markRowsAsExported(connection, ids) {
  const exportedAt = toMysqlDateTime(new Date());

  for (const id of ids) {
    await connection.execute(
      `UPDATE work_log
       SET exported_to_sheet_at = :exportedAt
       WHERE id = :id`,
      {
        id,
        exportedAt
      }
    );
  }
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
