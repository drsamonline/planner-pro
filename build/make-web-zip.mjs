/**
 * Builds the offline web bundle: dist/planner-pro-web.zip
 *
 * The zip unpacks to a folder you can open from disk (index.html) or drop on any
 * static host. CSS and JS are minified (whitespace + syntax only, identifiers are
 * left alone — see build/minify.mjs); everything else is copied verbatim.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { minifyCss, minifyJs } from './minify.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const DIST = path.join(ROOT, 'dist');
const STAGE = path.join(DIST, 'planner-pro-web');
const ZIP = path.join(DIST, 'planner-pro-web.zip');

let before = 0;
let after = 0;

async function minifyTree(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { await minifyTree(full); continue; }

    const ext = path.extname(entry.name);
    if (ext !== '.css' && ext !== '.js') continue;

    const source = fs.readFileSync(full, 'utf8');
    before += Buffer.byteLength(source);
    const out = ext === '.css' ? await minifyCss(source) : await minifyJs(source);
    after += Buffer.byteLength(out);
    fs.writeFileSync(full, out);
  }
}

fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE, { recursive: true });
fs.cpSync(APP, STAGE, { recursive: true });

await minifyTree(STAGE);

// a README inside the zip, for whoever opens it in six months
fs.writeFileSync(path.join(STAGE, 'READ-ME-FIRST.txt'), `Planner Pro v14.2.0 — offline build
Copyright 2026 Dr. Sohil Momin · PolyForm Noncommercial 1.0.0

Open index.html in any modern browser. That's it — no server, no install.
Your data is stored by the browser for this file; keep the folder in one place
and export a JSON backup from Settings now and then.

If your browser blocks local storage for file:// pages, serve the folder instead:
  python3 -m http.server 8080
then visit http://localhost:8080

CSS and JS in this build are minified. Readable source lives in the repository
under app/. Source and issues: https://github.com/drsamonline/planner-pro
`);

fs.rmSync(ZIP, { force: true });
try {
  execFileSync('zip', ['-qr', ZIP, '.'], { cwd: STAGE });
} catch (e) {
  console.error('zip is required to build the web bundle (apt install zip)');
  process.exit(1);
}

const zipKb = (fs.statSync(ZIP).size / 1024).toFixed(1);
const saved = before ? Math.round((1 - after / before) * 100) : 0;
console.log(`✓ assets ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB (−${saved}%)`);
console.log(`✓ dist/planner-pro-web.zip — ${zipKb} KB`);
