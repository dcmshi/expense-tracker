#!/usr/bin/env node
/**
 * Generate PNG screenshots for all UI mockup screens.
 *
 * Usage:
 *   node scripts/generate-screenshots.js
 *
 * Requires puppeteer:
 *   npm install --save-dev puppeteer   (run once from repo root)
 */

const puppeteer = require('puppeteer');
const path = require('path');

const SCREENS = [
  { file: '01-expense-list',    label: 'Expense List'     },
  { file: '02-add-hub',        label: 'Add Hub'           },
  { file: '03-manual-entry',   label: 'Manual Entry'      },
  { file: '04-receipt-capture',label: 'Receipt Capture'   },
  { file: '05-voice-capture',  label: 'Voice Capture'     },
  { file: '06-edit-verify',    label: 'Edit & Verify'     },
  { file: '07-analytics',      label: 'Analytics'         },
];

const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'screenshots');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // iPhone 14 dimensions @2x
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });

  for (const screen of SCREENS) {
    const htmlPath = path.join(SCREENSHOTS_DIR, `${screen.file}.html`);
    const pngPath  = path.join(SCREENSHOTS_DIR, `${screen.file}.png`);

    const url = `file://${htmlPath.replace(/\\/g, '/')}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.screenshot({ path: pngPath });

    console.log(`✓  ${screen.label.padEnd(20)} → screenshots/${screen.file}.png`);
  }

  await browser.close();
  console.log('\nDone — 7 screenshots written to screenshots/');
})();
