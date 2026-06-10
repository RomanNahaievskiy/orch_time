// Відповідає за поведінку фронтенду: скан коду, один POST /api/punch, показ результату та повернення фокусу в поле.
const form = document.getElementById('punchForm');
const input = document.getElementById('employeeCode');
const button = document.getElementById('punchButton');
const statusText = document.getElementById('statusText');
const modal = document.getElementById('modal');
const modalBox = document.getElementById('modalBox');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

const terminalId = window.localStorage.getItem('terminalId') || createTerminalId();

function createTerminalId() {
  const value = `terminal-${crypto.randomUUID()}`;
  window.localStorage.setItem('terminalId', value);
  return value;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const employeeCode = input.value.trim();
  if (!employeeCode) {
    showModal('Скануйте код працівника', false);
    return;
  }

  setBusy(true);

  try {
    const response = await fetch('/api/punch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        employeeCode,
        terminalId,
        requestId: crypto.randomUUID()
      })
    });

    const result = await response.json();
    showModal(result.message || 'Дію виконано', Boolean(result.ok));
  } catch (error) {
    showModal('Немає звʼязку із сервером', false);
  } finally {
    setBusy(false);
  }
});

modalClose.addEventListener('click', resetTerminal);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !modal.hidden) {
    resetTerminal();
  }
});

function setBusy(isBusy) {
  button.disabled = isBusy;
  input.disabled = isBusy;
  statusText.textContent = isBusy ? 'Записуємо відмітку...' : 'Готово до сканування';
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
  statusText.textContent = 'Готово до сканування';
  input.focus();
}
