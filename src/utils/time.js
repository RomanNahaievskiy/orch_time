// Відповідає за розрахунки часу зміни та форматування повідомлень для термінала.
export function diffMinutes(start, end) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function formatWorkedTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours} год ${restMinutes} хв`;
}

export function toMysqlDateTime(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}
