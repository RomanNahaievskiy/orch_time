<!-- Відповідає за інструкцію розгортання Node.js додатку ОРЧ на хостингу з піддоменом, MySQL та SSL. -->

# Розгортання на сервері

Цей проєкт можна запускати на піддомені через Node.js-менеджер хостингу.

## 1. Піддомен

Піддомен уже створено, наприклад:

```text
orch.test
```

У панелі хостингу треба відкрити налаштування `Node JS` для цього піддомену.

## 2. Node.js

Рекомендована версія:

```text
Node.js 18 або 20
```

Стартовий файл:

```text
src/server.js
```

Команда встановлення залежностей:

```bash
npm install
```

Команда запуску, якщо панель просить script:

```bash
npm start
```

Додаток сам бере адресу запуску із `process.env.PORT`, тому він підходить для хостингів, де панель видає не TCP-порт, а socket.

Для твого хостингу це може бути щось на кшталт:

```text
/var/www/ch5e4ff3dd/.system/nodejs/orch.test/socket
```

У коді це вже підтримано: `src/server.js` викликає `app.listen(process.env.PORT || 3000)`.

## 3. MySQL

У панелі хостингу треба створити:

- базу даних;
- користувача бази;
- пароль; WQfcXDEpuI
- прив'язати користувача до бази з повними правами.

Після цього в phpMyAdmin або іншому SQL-інструменті виконати файл:

```text
sql/schema.sql
```

## 4. .env

На сервері треба створити файл `.env` поруч із `package.json`.

Приклад:

```env
PORT=3000
NODE_ENV=production

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_mysql_user
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=your_mysql_database
MYSQL_CONNECTION_LIMIT=10

SHIFT_OVERTIME_HOURS=17
```

На багатьох хостингах `MYSQL_HOST` буде `localhost`, але іноді панель дає окремий host.

## 5. SSL

У вкладці `SSL` треба увімкнути сертифікат для піддомену. Після цього термінали краще відкривати тільки через:

```text
https://orch.test
```

## 6. Перевірка

Після запуску Node.js перевірити:

```text
https://orch.test/api/health
```

Очікувана відповідь:

```json
{
  "ok": true,
  "service": "klr-orch-time-terminal"
}
```

## 7. Важливо

Google Sheets не потрібен для самого натискання кнопки. Спочатку має працювати ланцюг:

```text
Frontend -> Node.js -> MySQL
```

Синхронізацію довідника працівників і експорт журналу в Google Sheets можна підключати наступним етапом.
