// Відповідає за читання і нормалізацію змінних середовища для сервера, MySQL та Google Sheets.
import dotenv from 'dotenv';

dotenv.config();

function readNumber(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  listenTarget: process.env.PORT || 3000,
  overtimeHours: readNumber('SHIFT_OVERTIME_HOURS', 17),
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: readNumber('MYSQL_PORT', 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'orch_time',
    connectionLimit: readNumber('MYSQL_CONNECTION_LIMIT', 10)
  },
  google: {
    employeesSheetId: process.env.GOOGLE_EMPLOYEES_SHEET_ID || '',
    employeesSheetRange: process.env.GOOGLE_EMPLOYEES_SHEET_RANGE || 'Аркуш1!A:E',
    workLogSheetId: process.env.GOOGLE_WORK_LOG_SHEET_ID || '',
    workLogSheetRange: process.env.GOOGLE_WORK_LOG_SHEET_RANGE || 'Аркуш1!A:H',
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    privateKey: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  }
};
