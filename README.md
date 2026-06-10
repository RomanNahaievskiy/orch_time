<!-- Відповідає за короткий опис першої чорнової версії, запуску, структури та потоку даних ОРЧ. -->

# KLR ОРЧ Time Terminal

Перша чорнова Node.js-версія однокнопкового додатку обліку робочого часу.

## Потік даних

```text
Google Sheet "Довідник працівників"
        ↓ sync/import
MySQL employees
        ↓
Node.js backend = єдине джерело істини для дій
        ↓
MySQL work_log = оперативний журнал
        ↓ sync/export
Google Sheet "Журнал ОРЧ"
```

Під час скану термінал звертається тільки до `Node.js -> MySQL`. Google Sheets не бере участі в критичному шляху.

## Запуск

1. Створити базу MySQL і виконати `sql/schema.sql`.
2. Скопіювати `.env.example` у `.env` і заповнити доступи.
3. Встановити залежності:

```bash
npm install
```

4. Запустити сервер:

```bash
npm run dev
```

Термінал буде доступний за адресою `http://localhost:3000`.

## API

- `POST /api/punch` - єдина дія термінала: сервер сам вирішує почати чи завершити зміну.
- `POST /api/sync/employees` - заготовка синхронізації довідника з Google Sheets у MySQL.
- `POST /api/export/journal` - заготовка експорту журналу з MySQL у Google Sheets.
- `GET /api/health` - перевірка доступності сервера.
