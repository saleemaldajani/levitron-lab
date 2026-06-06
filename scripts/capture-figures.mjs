#!/usr/bin/env node
/**
 * Headless figure capture for paper/figures/
 * Usage: npm run build && npm run figures
 * Requires: playwright (devDependency), preview server on PORT (default 4173)
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'paper', 'figures');
const PORT = process.env.PREVIEW_PORT || '4173';
const BASE = `http://127.0.0.1:${PORT}`;

if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(ROOT, '.playwright-browsers');
}

const CAPTURES = [
  { hash: 'earnshaw', selector: '.hero-canvas', file: 'fig_earnshaw_saddle.png', wait: 2500 },
  {
    hash: 'earnshaw',
    selector: '[aria-label="Force curve with levitator position"]',
    file: 'fig_earnshaw_force.png',
    wait: 1500,
  },
  { hash: 'feedback1d', selector: '.hero-canvas', file: 'fig_feedback1d_globe.png', wait: 3500 },
  { hash: 'feedback1d', selector: '.eigen-panel', file: 'fig_feedback1d_eigs.png', wait: 800 },
  { hash: 'feedback2d', selector: '.hero-canvas', file: 'fig_feedback2d_topview.png', wait: 3500 },
  { hash: 'feedback2d', selector: '.live-plots', file: 'fig_feedback2d_traces.png', wait: 5000 },
  { hash: 'feedback2d', selector: '.eigen-panel', file: 'fig_feedback2d_eigs.png', wait: 800 },
  { hash: 'gyroscopic', selector: '[data-figure="fig_gyro_stable"]', file: 'fig_gyro_stable.png', wait: 7000 },
  { hash: 'gyroscopic', selector: '[data-figure="fig_gyro_potential"]', file: 'fig_gyro_potential.png', wait: 1200 },
  { hash: 'gyroscopic', selector: '[data-figure="fig_gyro_theta_trace"]', file: 'fig_gyro_theta_trace.png', wait: 800 },
  { hash: 'dynamical', selector: '.hero-canvas', file: 'fig_rotor_trap.png', wait: 4500 },
  {
    hash: 'dynamical',
    selector: '[aria-label="Floater potential energy"]',
    file: 'fig_rotor_potential.png',
    wait: 800,
  },
];

function runPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', PORT], {
      cwd: ROOT,
      stdio: 'pipe',
      shell: true,
    });
    let ready = false;
    proc.stdout.on('data', (d) => {
      const s = d.toString();
      if (!ready && s.includes('Local:')) {
        ready = true;
        resolve(proc);
      }
    });
    proc.stderr.on('data', (d) => {
      const s = d.toString();
      if (!ready && s.includes('Local:')) {
        ready = true;
        resolve(proc);
      }
    });
    proc.on('error', reject);
    setTimeout(() => {
      if (!ready) {
        ready = true;
        resolve(proc);
      }
    }, 8000);
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log('Building app…');
  await new Promise((res, rej) => {
    const b = spawn('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true });
    b.on('exit', (c) => (c === 0 ? res() : rej(new Error('build failed'))));
  });

  console.log('Starting preview server…');
  const preview = await runPreview();
  await new Promise((r) => setTimeout(r, 1500));

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });

  for (const cap of CAPTURES) {
    console.log(`Capturing ${cap.file}…`);
    await page.goto(`${BASE}/#${cap.hash}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(cap.wait);
    const el = page.locator(cap.selector).first();
    await el.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    await el.screenshot({ path: path.join(OUT, cap.file) });
  }

  await browser.close();
  preview.kill('SIGTERM');
  console.log(`Figures written to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
