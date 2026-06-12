// Відповідає за поведінку адмінської панелі: оновлення станів, запуск синхронізації, експорт і повідомлення про результат.
const generatedAt = document.getElementById('generatedAt');
const totalActive = document.getElementById('totalActive');
const onShift = document.getElementById('onShift');
const offShift = document.getElementById('offShift');
const forgotToClose = document.getElementById('forgotToClose');
const employeesTable = document.getElementById('employeesTable');
const refreshButton = document.getElementById('refreshButton');
const syncEmployeesButton = document.getElementById('syncEmployeesButton');
const exportJournalButton = document.getElementById('exportJournalButton');
const toast = document.getElementById('toast');

refreshButton.addEventListener('click', refreshStatus);
syncEmployeesButton.addEventListener('click', syncEmployees);
exportJournalButton.addEventListener('click', exportJournal);

refreshStatus();
window.setInterval(refreshStatus, 30000);

async function refreshStatus() {
  setButtonsBusy(true);

  try {
    const data = await getJson('/api/admin/status');
    renderStatus(data);
  } catch (error) {
    showToast(error.message || 'Не вдалося оновити стан');
  } finally {
    setButtonsBusy(false);
  }
}

async function syncEmployees() {
  setButtonsBusy(true);

  try {
    const result = await postJson('/api/sync/employees');
    showToast(result.message);
    await refreshStatus();
  } catch (error) {
    showToast(error.message || 'Синхронізація не вдалася');
  } finally {
    setButtonsBusy(false);
  }
}

async function exportJournal() {
  setButtonsBusy(true);

  try {
    const result = await postJson('/api/export/journal');
    showToast(result.message);
  } catch (error) {
    showToast(error.message || 'Експорт не вдався');
  } finally {
    setButtonsBusy(false);
  }
}

function renderStatus(data) {
  totalActive.textContent = data.summary.totalActive;
  onShift.textContent = data.summary.onShift;
  offShift.textContent = data.summary.offShift;
  forgotToClose.textContent = data.summary.forgotToClose;
  generatedAt.textContent = `Оновлено: ${formatDateTime(data.generatedAt)}`;

  employeesTable.innerHTML = data.employees.map(renderEmployeeRow).join('');
}

function renderEmployeeRow(employee) {
  const badge = getBadge(employee);

  return `<tr>
    <td>${badge}</td>
    <td>${escapeHtml(employee.externalCode)}</td>
    <td>${escapeHtml(employee.fullName)}</td>
    <td>${escapeHtml(employee.department || '')}</td>
    <td>${employee.startedAt ? formatDateTime(employee.startedAt) : ''}</td>
    <td>${employee.onShift ? formatDuration(employee.minutesOnShift) : ''}</td>
  </tr>`;
}

function getBadge(employee) {
  if (employee.forgotToClose) {
    return '<span class="badge warn">ЗАБУВ ЗАКРИТИ</span>';
  }

  if (employee.onShift) {
    return '<span class="badge on">НА ЗМІНІ</span>';
  }

  return '<span class="badge off">НЕ НА ЗМІНІ</span>';
}

async function getJson(url) {
  const response = await fetch(url);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Запит відхилено');
  }

  return result;
}

async function postJson(url) {
  const response = await fetch(url, { method: 'POST' });
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Запит відхилено');
  }

  return result;
}

function setButtonsBusy(isBusy) {
  refreshButton.disabled = isBusy;
  syncEmployeesButton.disabled = isBusy;
  exportJournalButton.disabled = isBusy;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('uk-UA', {
    dateStyle: 'short',
    timeStyle: 'medium'
  }).format(new Date(value));
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return `${hours} год ${restMinutes} хв`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
