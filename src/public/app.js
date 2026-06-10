// Відповідає за поведінку фронтенду: скан коду, показ дозволеної сервером кнопки, підтвердження дії та повернення фокусу в поле.
const form = document.getElementById('punchForm');
const input = document.getElementById('employeeCode');
const button = document.getElementById('punchButton');
const statusText = document.getElementById('statusText');
const modal = document.getElementById('modal');
const modalBox = document.getElementById('modalBox');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

const terminalId = window.localStorage.getItem('terminalId') || createTerminalId();
let pendingScan = null;

function createTerminalId() {
  const value = `terminal-${createId()}`;
  window.localStorage.setItem('terminalId', value);
  return value;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  const randomPart = Math.random().toString(36).slice(2);
  return `${Date.now().toString(36)}-${randomPart}`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  await scanEmployeeCode();
});

button.addEventListener('click', async () => {
  if (!pendingScan) {
    await scanEmployeeCode();
    return;
  }

  await confirmPunch();
});

input.addEventListener('input', () => {
  clearPendingScan();
});

modalClose.addEventListener('click', resetTerminal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) {
    resetTerminal();
  }
});

async function scanEmployeeCode() {
  const employeeCode = input.value.trim();

  if (!employeeCode) {
    showModal('Скануйте код працівника', false);
    return;
  }

  setBusy(true, 'Перевіряємо код...');

  try {
    const result = await postJson('/api/scan', { employeeCode });

    if (result.decision === 'ALLOW') {
      pendingScan = {
        employeeCode,
        action: result.action
      };
      button.textContent = result.buttonText || 'ПІДТВЕРДИТИ';
      button.hidden = false;
      statusText.textContent = result.message || 'Дію дозволено';
      button.focus();
      return;
    }

    clearPendingScan();
    showModal(result.message || 'Дію заборонено', false);
  } catch (error) {
    clearPendingScan();
    showModal(error.message || 'Немає звʼязку із сервером', false);
  } finally {
    setBusy(false);
  }
}

async function confirmPunch() {
  setBusy(true, 'Записуємо відмітку...');

  try {
    const result = await postJson('/api/punch', {
      employeeCode: pendingScan.employeeCode,
      terminalId,
      requestId: createId(),
      expectedAction: pendingScan.action
    });

    clearPendingScan();
    showModal(result.message || 'Дію виконано', Boolean(result.ok));
  } catch (error) {
    clearPendingScan();
    showModal(error.message || 'Немає звʼязку із сервером', false);
  } finally {
    setBusy(false);
  }
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Запит відхилено');
  }

  return result;
}

function setBusy(isBusy, message = 'Готово до сканування') {
  button.disabled = isBusy;
  input.disabled = isBusy;
  statusText.textContent = isBusy ? message : statusText.textContent || message;
}

function clearPendingScan() {
  pendingScan = null;
  button.hidden = true;
  button.textContent = 'ПІДТВЕРДИТИ';
  statusText.textContent = 'Готово до сканування';
}

function showModal(message, ok) {
  modalBox.dataset.kind = ok ? 'ok' : 'error';
  modalMessage.textContent = message;
  modal.hidden = false;
  modalClose.focus();

  if (ok) {
    window.setTimeout(resetTerminal, 2600);
  }
}

function resetTerminal() {
  modal.hidden = true;
  form.reset();
  input.disabled = false;
  button.disabled = false;
  clearPendingScan();
  input.focus();
}
