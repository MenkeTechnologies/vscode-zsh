// Regression test for lib/resolveBinary.js — the fix for the uncaught
// "Client is not running and can't be stopped" / "Pending response rejected"
// errors that fired when the editor's PATH (GUI launch) didn't include the
// zshrs binary. Runs headless in CI (no `vscode` dependency).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { resolveZshrsBinary, defaultFallbackDirs } = require('../lib/resolveBinary');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zshrs-resolver-'));
const binDir = path.join(tmp, 'bin');
fs.mkdirSync(binDir);
const exe = path.join(binDir, 'zshrs');
fs.writeFileSync(exe, '#!/bin/sh\nexit 0\n');
fs.chmodSync(exe, 0o755);
const notExe = path.join(tmp, 'not-exec');
fs.writeFileSync(notExe, 'x');
fs.chmodSync(notExe, 0o644);

const origPath = process.env.PATH;
test.after(() => {
  process.env.PATH = origPath;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('bare name resolves via PATH', () => {
  process.env.PATH = binDir;
  assert.equal(resolveZshrsBinary('zshrs'), exe);
});

test('GUI-launch bug: bare name resolves via fallback dir even with PATH empty', () => {
  process.env.PATH = '';
  assert.equal(resolveZshrsBinary('zshrs', [binDir]), exe);
});

test('PATH is searched before fallback dirs', () => {
  process.env.PATH = binDir;
  assert.equal(resolveZshrsBinary('zshrs', ['/nonexistent']), exe);
});

test('explicit executable path is returned as-is', () => {
  assert.equal(resolveZshrsBinary(exe), exe);
});

test('explicit non-executable / missing path returns undefined (no client start)', () => {
  assert.equal(resolveZshrsBinary(path.join(tmp, 'nope', 'zshrs')), undefined);
  assert.equal(resolveZshrsBinary(notExe), undefined);
});

test('missing bare name returns undefined', () => {
  process.env.PATH = binDir;
  assert.equal(resolveZshrsBinary('zshrs-does-not-exist', []), undefined);
});

test('production fallback list includes the cargo + Homebrew prefixes', () => {
  // Guards against silently reintroducing the GUI-PATH bug for cargo/brew installs.
  const dirs = defaultFallbackDirs();
  assert.ok(dirs.includes('/opt/homebrew/bin'));
  assert.ok(dirs.some((d) => d.endsWith(path.join('.cargo', 'bin'))));
});
