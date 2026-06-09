#!/usr/bin/env node
'use strict';

const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { runPipeline } = require('./index');

const LOG_FILE = path.join(__dirname, 'logs', 'scheduler.log');

function ensureLog() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function log(msg) {
  ensureLog();
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function startScheduler() {
  const expr = config.SCHEDULE_CRON;

  if (!cron.validate(expr)) {
    console.error(`[scheduler] Invalid SCHEDULE_CRON: "${expr}"`);
    console.error('  Example: "0 12 * * *" = daily at noon UTC');
    process.exit(1);
  }

  log('FIFA Content Scheduler started');
  log(`Schedule: "${expr}"  (change via SCHEDULE_CRON in .env)`);
  log('Press Ctrl+C to stop\n');

  cron.schedule(expr, async () => {
    log('⚡ Running scheduled pipeline...');
    try {
      const result = await runPipeline();
      log(`✅ Success: "${result.title}" → ${result.youtubeUrl || '(no upload)'}`);
    } catch (err) {
      log(`❌ Pipeline failed: ${err.message}`);
    }
  }, { timezone: 'UTC' });
}

startScheduler();
