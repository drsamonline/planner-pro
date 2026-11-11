/**
 * Bundles the app into one portable HTML file.
 *
 *   node build/make-single-file.mjs  →  dist/planner-pro.html
 *
 * Everything is inlined: CSS in a <style> block, each script in a <script>
 * block, icons as data URIs. The result opens by double-click, from a USB
 * stick, or from any static host — no server, no manifest, no service worker.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'app');
const OUT_DIR = path.join(ROOT, 'dist');
const OUT = path.join(OUT_DIR, 'planner-pro.html');

let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');

/* --- inline the stylesheet --- */
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_m, href) => {
  const css = fs.readFileSync(path.join(APP, href), 'utf8');
  return `<style>\n${css}\n</style>`;
});

/* --- inline every script, in document order --- */
html = html.replace(/<script src="([^"]+)"><\/script>/g, (_m, src) => {
  const js = fs.readFileSync(path.join(APP, src), 'utf8');
  // guard against a stray </script> inside a string literal
  const safe = js.replace(/<\/script>/gi, '<\\/script>');
  return `<script>\n/* ${src} */\n${safe}\n</script>`;
});

/* --- drop things that only make sense on a served origin --- */
html = html.replace(/<link rel="manifest"[^>]*>\n?/g, '');
html = html.replace(/<link rel="icon"[^>]*>\n?/g, '');
html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n?/g, '');

/* --- inline the favicon as a data URI so the tab still has an icon --- */
const favicon = fs.readFileSync(path.join(APP, 'assets/img/favicon.svg'), 'utf8');
html = html.replace('</title>', `</title>\n<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}">`);

/* --- a small banner so the file explains itself --- */
html = html.replace('<body data-theme="midnight">', `<body data-theme="midnight">
<!--
  Planner Pro v14.10.0 — single-file build
  Copyright 2026 Dr. Sohil Momin · PolyForm Noncommercial 1.0.0
  This file is the whole app. Open it in any browser; it needs no server.
  Source: https://github.com/drsamonline/planner-pro
-->`);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`✓ dist/planner-pro.html — ${kb} KB, self-contained`);
