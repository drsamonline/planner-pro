/**
 * Minifies the shipped CSS and JS.
 *
 * Deliberately conservative: whitespace and syntax only, never identifier
 * renaming — the app is a set of classic scripts that talk to each other through
 * globals (DateUtil, Store, UI, Views, Parts), and mangling those names would
 * break every cross-file call for a few extra kilobytes.
 */
import { transform } from 'esbuild';

const OPTS = { minifyWhitespace: true, minifySyntax: true, minifyIdentifiers: false, legalComments: 'none' };

export async function minifyCss(code) {
  const out = await transform(code, { ...OPTS, loader: 'css' });
  return out.code;
}

export async function minifyJs(code) {
  const out = await transform(code, { ...OPTS, loader: 'js', target: 'es2019' });
  return out.code;
}

export function kb(text) {
  return (Buffer.byteLength(text) / 1024).toFixed(1);
}
