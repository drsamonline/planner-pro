/**
 * Builds the offline web bundle: dist/planner-pro-web.zip
 * The zip unpacks to a folder you can open from disk (index.html) or drop on
 * any static host. No build tooling required — this only copies and zips.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'planner-pro-web');
const ZIP = path.join(DIST, 'planner-pro-web.zip');

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
fs.cpSync(APP, STAGE, { recursive: true });

// a README inside the zip, for whoever opens it in six months
fs.writeFileSync(path.join(STAGE, 'READ-ME-FIRST.txt'), `Planner Pro v14.0.0 — offline build
Copyright 2026 Dr. Sohil Momin · PolyForm Noncommercial 1.0.0

Open index.html in any modern browser. That's it — no server, no install.
Your data is stored by the browser for this file; keep the folder in one place
and export a JSON backup from Settings now and then.

If your browser blocks local storage for file:// pages, serve the folder instead:
  python3 -m http.server 8080
then visit http://localhost:8080

Source and issues: https://github.com/drsamonline/planner-pro
`);

fs.rmSync(ZIP, { force: true });
try {
  execFileSync('zip', ['-qr', ZIP, '.'], { cwd: STAGE });
} catch (e) {
  console.error('zip is required to build the web bundle (apt install zip)');
  process.exit(1);
}

const kb = (fs.statSync(ZIP).size / 1024).toFixed(1);
console.log(`✓ dist/planner-pro-web.zip — ${kb} KB`);
