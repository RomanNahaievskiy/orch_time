// Відповідає за старт Express-сервера, підключення статичного фронтенду та обробку помилок API.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    message: 'Маршрут не знайдено'
  });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({
    ok: false,
    message: 'Серверна помилка'
  });
});

if (typeof config.listenTarget === 'string' && config.listenTarget.includes('/')) {
  try {
    if (fs.existsSync(config.listenTarget)) {
      fs.unlinkSync(config.listenTarget);
    }
  } catch (error) {
    console.warn(`Cannot remove stale socket ${config.listenTarget}: ${error.message}`);
  }
}

app.listen(config.listenTarget, () => {
  console.log(`KLR ОРЧ terminal listening on ${config.listenTarget}`);
});
