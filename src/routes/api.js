// Відповідає за HTTP API: одну кнопку /api/punch, health-check, перевірку MySQL та чорнові endpoints синхронізації Google Sheets.
import express from 'express';
import { pool } from '../db.js';
import { punch } from '../services/punchService.js';
import { syncEmployeesFromGoogleSheet } from '../services/employeeSyncService.js';
import { exportWorkLogToGoogleSheet } from '../services/journalExportService.js';

export const apiRouter = express.Router();

apiRouter.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'klr-orch-time-terminal'
  });
});

apiRouter.get('/health/db', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS db_ok');

    res.json({
      ok: true,
      database: rows[0].db_ok === 1 ? 'connected' : 'unknown'
    });
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/punch', async (req, res, next) => {
  try {
    const result = await punch({
      employeeCode: req.body.employeeCode,
      terminalId: req.body.terminalId,
      requestId: req.body.requestId
    });

    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/sync/employees', async (req, res, next) => {
  try {
    const result = await syncEmployeesFromGoogleSheet();
    res.status(result.ok ? 200 : 501).json(result);
  } catch (error) {
    next(error);
  }
});

apiRouter.post('/export/journal', async (req, res, next) => {
  try {
    const result = await exportWorkLogToGoogleSheet();
    res.status(result.ok ? 200 : 501).json(result);
  } catch (error) {
    next(error);
  }
});
