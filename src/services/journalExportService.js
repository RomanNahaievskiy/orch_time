// Відповідає за експорт оперативного журналу з MySQL work_log у Google Sheet "Журнал ОРЧ"; у цій версії містить чорновий контракт експорту.
import { config } from '../config.js';

export async function exportWorkLogToGoogleSheet() {
  if (!config.google.workLogSheetId) {
    return {
      ok: false,
      message: 'GOOGLE_WORK_LOG_SHEET_ID не налаштовано'
    };
  }

  return {
    ok: false,
    message: 'Експорт журналу ще не реалізовано. Контракт endpoint вже підготовлено.'
  };
}
