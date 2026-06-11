// Відповідає за формування Excel-сумісного XLS-файлу журналу ОРЧ без додаткових npm-залежностей.
import { pool } from '../db.js';

export async function buildJournalXls() {
  const [rows] = await pool.execute(
    `SELECT
       wl.id,
       e.external_code,
       e.full_name,
       wl.start_time,
       wl.end_time,
       wl.duration_minutes,
       wl.status,
       wl.terminal_start_id,
       wl.terminal_end_id,
       wl.created_at,
       wl.exported_to_sheet_at
     FROM work_log wl
     JOIN employees e ON e.id = wl.employee_id
     ORDER BY wl.start_time DESC, wl.id DESC`
  );

  return renderExcelHtml(rows);
}

function renderExcelHtml(rows) {
  const headers = [
    'ID',
    'Код працівника',
    'ПІБ',
    'Початок зміни',
    'Кінець зміни',
    'Хвилин',
    'Статус',
    'Термінал старту',
    'Термінал фінішу',
    'Створено',
    'Експортовано в Sheet'
  ];

  const bodyRows = rows.map((row) => [
    row.id,
    row.external_code,
    row.full_name,
    formatDate(row.start_time),
    formatDate(row.end_time),
    row.duration_minutes ?? '',
    row.status,
    row.terminal_start_id ?? '',
    row.terminal_end_id ?? '',
    formatDate(row.created_at),
    formatDate(row.exported_to_sheet_at)
  ]);

  const thead = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const tbody = bodyRows
    .map((cells) => `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      table { border-collapse: collapse; }
      th, td { border: 1px solid #999; padding: 6px; }
      th { background: #eeeeee; font-weight: bold; }
    </style>
  </head>
  <body>
    <table>
      <thead><tr>${thead}</tr></thead>
      <tbody>${tbody}</tbody>
    </table>
  </body>
</html>`;
}

function formatDate(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
