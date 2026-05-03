#!/usr/bin/env node
// Enforces CLAUDE.md rule: tests must not launch headed browsers.
// Fails the build if `headless: false` appears anywhere in the package
// (excluding node_modules / build output / this script itself).

import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');

const pattern = String.raw`headless\s*:\s*false`;
const cmd = [
  'grep -rEn',
  '--exclude-dir=node_modules',
  '--exclude-dir=dist',
  '--exclude-dir=.next',
  '--exclude-dir=playwright-report',
  '--exclude-dir=test-results',
  "--exclude='check-headless.mjs'",
  `'${pattern}' .`,
  '|| true',
].join(' ');

const out = execSync(`bash -c "${cmd}"`, { cwd: pkgRoot, encoding: 'utf8' }).trim();

if (out) {
  console.error('\n[check-headless] FAIL: `headless: false` is forbidden by CLAUDE.md.');
  console.error('Tests must run in headless mode only. Offending lines:\n');
  console.error(out);
  process.exit(1);
}

console.log('[check-headless] ok — no headed-browser usage found.');
