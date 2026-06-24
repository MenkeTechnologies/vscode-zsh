// Regression tests for the extension's runtime wiring:
//   1. The LSP is spawned as bare `zshrs --lsp` (no `--stdio` appended).
//   2. A missing binary never constructs the LanguageClient.
//   3. Run + debug are registered; the debug type is `zshrs`.
//   4. The debug config provider fills in the active file for F5-with-no-launch.json.
//
// extension.js requires `vscode` + `vscode-languageclient/node`; we intercept
// require() with stubs and capture what the extension registers. The debug
// adapter bridge itself (real sockets + zshrs) is covered by dapbridge_test.js.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const Module = require('module');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zshrs-activate-'));
const fakeBin = path.join(tmp, 'zshrs');
fs.writeFileSync(fakeBin, '#!/bin/sh\n');
fs.chmodSync(fakeBin, 0o755);

let captured;
let clientCtorCalls;
let reg;

class DebugAdapterServer { constructor(port, host) { this.port = port; this.host = host; } }

function loadExtensionWith(configPath, activeEditor) {
  captured = undefined;
  clientCtorCalls = 0;
  reg = { commands: {}, dcp: {}, daf: {}, termHandlers: [] };
  delete require.cache[require.resolve('../extension.js')];

  const vscodeStub = {
    workspace: {
      getConfiguration: () => ({ get: (key, def) => (key === 'path' ? configPath : def) }),
      createFileSystemWatcher: () => ({ dispose() {} }),
      getWorkspaceFolder: () => undefined
    },
    window: { showWarningMessage() {}, showErrorMessage() {}, activeTextEditor: activeEditor },
    commands: { registerCommand: (id, fn) => { reg.commands[id] = fn; return { dispose() {} }; } },
    debug: {
      registerDebugConfigurationProvider: (t, p) => { reg.dcp[t] = p; return { dispose() {} }; },
      registerDebugAdapterDescriptorFactory: (t, f) => { reg.daf[t] = f; return { dispose() {} }; },
      onDidTerminateDebugSession: (h) => { reg.termHandlers.push(h); return { dispose() {} }; },
      startDebugging: () => Promise.resolve(true)
    },
    DebugAdapterServer
  };
  class FakeLanguageClient {
    constructor(_id, _name, serverOptions) { clientCtorCalls += 1; captured = serverOptions; }
    start() { return Promise.resolve(); }
    isRunning() { return false; }
    stop() { return Promise.resolve(); }
  }
  const lcStub = { LanguageClient: FakeLanguageClient, TransportKind: { stdio: 0, ipc: 1, pipe: 2 } };

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return vscodeStub;
    if (request === 'vscode-languageclient/node') return lcStub;
    return origLoad.call(this, request, parent, isMain);
  };
  try {
    const ext = require('../extension.js');
    ext.activate({ subscriptions: [] });
    return ext;
  } finally {
    Module._load = origLoad;
  }
}

test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('LSP is spawned as bare `zshrs --lsp` (no --stdio-triggering transport)', () => {
  loadExtensionWith(fakeBin);
  assert.equal(clientCtorCalls, 1);
  assert.deepEqual(captured.run.args, ['--lsp']);
  assert.equal(captured.run.transport, undefined);
  assert.equal(captured.debug.transport, undefined);
  assert.equal(captured.run.command, fakeBin);
});

test('missing binary → LanguageClient is never constructed', () => {
  loadExtensionWith(path.join(tmp, 'does-not-exist', 'zshrs'));
  assert.equal(clientCtorCalls, 0);
  assert.equal(captured, undefined);
});

test('run + debug commands, providers, and terminate-cleanup are registered', () => {
  loadExtensionWith(path.join(tmp, 'nope', 'zshrs'));
  assert.equal(typeof reg.commands['zshrs.run'], 'function');
  assert.equal(typeof reg.commands['zshrs.debug'], 'function');
  assert.ok(reg.dcp.zshrs, 'config provider registered for type zshrs');
  assert.ok(reg.daf.zshrs, 'adapter factory registered for type zshrs');
  assert.equal(reg.termHandlers.length, 1, 'a terminate handler is registered for bridge cleanup');
});

test('debug adapter factory: missing binary returns undefined (no broken session)', async () => {
  loadExtensionWith(path.join(tmp, 'gone', 'zshrs'));
  const desc = await reg.daf.zshrs.createDebugAdapterDescriptor({ id: 's1', configuration: {} });
  assert.equal(desc, undefined);
});

test('F5 with no launch.json fills in the active zsh file as program', () => {
  loadExtensionWith(fakeBin, { document: { languageId: 'zshrs' } });
  const out = reg.dcp.zshrs.resolveDebugConfiguration(undefined, {});
  assert.equal(out.type, 'zshrs');
  assert.equal(out.request, 'launch');
  assert.equal(out.program, '${file}');
});

test('debug config with no resolvable program is aborted', () => {
  loadExtensionWith(fakeBin, undefined);
  const out = reg.dcp.zshrs.resolveDebugConfiguration(undefined, {});
  assert.equal(out, undefined);
});
