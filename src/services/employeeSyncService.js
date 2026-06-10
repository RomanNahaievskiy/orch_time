// Відповідає за імпорт довідника працівників із Google Sheets у MySQL employees; у цій версії містить чорновий контракт синхронізації.
import { config } from '../config.js';

export async function syncEmployeesFromGoogleSheet() {
  if (!config.google.employeesSheetId) {
    return {
      ok: false,
      message: 'GOOGLE_EMPLOYEES_SHEET_ID не налаштовано'
    };
  }

  return {
    ok: false,
    message: 'Синхронізація довідника ще не реалізована. Контракт endpoint вже підготовлено.'
  };
}
