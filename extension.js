// vscode-zsh — language support, running, and debugging for zshrs.
//
// Syntax highlighting and filetype detection are declarative (see package.json
// + syntaxes/zshrs.tmLanguage.json). This module wires up the runtime pieces:
//   --lsp           Language Server (JSON-RPC on stdio) — diagnostics / hover / completion
//   --dap HOST:PORT Debug Adapter (connect-back TCP)    — breakpoints / stepping / variables
// Flags verified against `zshrs --help` and the zshrs dap.rs / lsp.rs servers.

const vscode = require('vscode');
const { LanguageClient } = require('vscode-languageclient/node');
const { resolveZshrsBinary } = require('./lib/resolveBinary');
const { startDapBridge } = require('./lib/dapBridge');

let client;
let runTerminal;
const bridges = new Map(); // debug session id -> { port, dispose }

function activate(context) {
  registerExecutionAndDebug(context);

  const config = vscode.workspace.getConfiguration('zshrs');
  if (config.get('lsp.enabled', true)) {
    startLanguageServer(context, config);
  }
}

function resolveOrWarn(configured, action) {
  const command = resolveZshrsBinary(configured);
  if (!command) {
    vscode.window.showWarningMessage(
      `zshrs not found for ${action}: could not find the \`${configured}\` binary. ` +
      `Set "zshrs.path" to the absolute path (e.g. ~/.cargo/bin/zshrs) or install it.`
    );
  }
  return command;
}

function shellQuote(s) {
  if (process.platform === 'win32') {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function activeZshrsEditor(action) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'zshrs') {
    vscode.window.showWarningMessage(`zshrs: open a zsh script to ${action}.`);
    return undefined;
  }
  return editor;
}

// `zshrs.run` — execute the active file in an integrated terminal.
function runFile() {
  const editor = activeZshrsEditor('run');
  if (!editor) return;
  const configured = vscode.workspace.getConfiguration('zshrs').get('path', 'zshrs');
  const command = resolveOrWarn(configured, 'running');
  if (!command) return;
  editor.document.save().then(() => {
    if (!runTerminal || runTerminal.exitStatus !== undefined) {
      runTerminal = vscode.window.createTerminal('zshrs');
    }
    runTerminal.show(true);
    runTerminal.sendText(`${shellQuote(command)} ${shellQuote(editor.document.uri.fsPath)}`);
  });
}

// `zshrs.debug` — launch a debug session for the active file.
function debugFile() {
  const editor = activeZshrsEditor('debug');
  if (!editor) return;
  editor.document.save().then(() => {
    vscode.debug.startDebugging(vscode.workspace.getWorkspaceFolder(editor.document.uri), {
      type: 'zshrs',
      request: 'launch',
      name: 'zshrs: Debug Current File',
      program: editor.document.uri.fsPath,
      cwd: '${workspaceFolder}',
      stopOnEntry: false
    });
  });
}

const debugConfigProvider = {
  resolveDebugConfiguration(_folder, config) {
    if (!config.type && !config.request && !config.name) {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document.languageId === 'zshrs') {
        config.type = 'zshrs';
        config.request = 'launch';
        config.name = 'zshrs: Debug Current File';
        config.program = '${file}';
        config.cwd = '${workspaceFolder}';
        config.stopOnEntry = false;
      }
    }
    if (!config.program) {
      vscode.window.showWarningMessage('zshrs debug: no `program` to debug (open a zsh script or set one in launch.json).');
      return undefined;
    }
    return config;
  }
};

// zshrs --dap is connect-back, so we bridge it: listen, spawn `zshrs --dap
// 127.0.0.1:<port>`, and have VS Code connect to the same port (DebugAdapterServer).
// The bridge pipes the VS Code and zshrs sockets together.
const debugAdapterFactory = {
  async createDebugAdapterDescriptor(session) {
    const configured = session.configuration.zshrsPath
      || vscode.workspace.getConfiguration('zshrs').get('path', 'zshrs');
    const command = resolveZshrsBinary(configured);
    if (!command) {
      vscode.window.showErrorMessage(
        `zshrs not found for debugging: could not find the \`${configured}\` binary. Set "zshrs.path".`
      );
      return undefined;
    }
    try {
      const bridge = await startDapBridge(command, (e) => {
        vscode.window.showErrorMessage(`zshrs --dap failed to spawn: ${e.message}`);
      });
      bridges.set(session.id, bridge);
      return new vscode.DebugAdapterServer(bridge.port);
    } catch (e) {
      vscode.window.showErrorMessage(`zshrs debug bridge failed: ${e.message}`);
      return undefined;
    }
  }
};

function registerExecutionAndDebug(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('zshrs.run', runFile),
    vscode.commands.registerCommand('zshrs.debug', debugFile),
    vscode.debug.registerDebugConfigurationProvider('zshrs', debugConfigProvider),
    vscode.debug.registerDebugAdapterDescriptorFactory('zshrs', debugAdapterFactory),
    vscode.debug.onDidTerminateDebugSession((s) => {
      const b = bridges.get(s.id);
      if (b) { b.dispose(); bridges.delete(s.id); }
    })
  );
}

function startLanguageServer(context, config) {
  const configured = config.get('path', 'zshrs');
  const command = resolveZshrsBinary(configured);
  const args = config.get('lsp.args', ['--lsp']);

  // Binary not found — do NOT start the client. Starting it would spawn-fail and
  // trigger vscode-languageclient's internal retry/stop cascade. Warn once and
  // leave syntax highlighting (which needs no server) working.
  if (!command) {
    vscode.window.showWarningMessage(
      `zshrs language server not started: could not find the \`${configured}\` binary. ` +
      `Set "zshrs.path" to the absolute path (e.g. ~/.cargo/bin/zshrs), install it, ` +
      `or disable "zshrs.lsp.enabled". Syntax highlighting still works.`
    );
    return;
  }

  // NOTE: do NOT set `transport: TransportKind.stdio`. For a command-based
  // server, vscode-languageclient reacts to that by appending `--stdio` to the
  // argv, so it would spawn `zshrs --lsp --stdio`. With transport omitted the
  // client still talks JSON-RPC over the process stdout/stdin, but spawns bare
  // `zshrs --lsp`.
  const serverOptions = {
    run: { command, args },
    debug: { command, args }
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'zshrs' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.zsh')
    }
  };

  client = new LanguageClient('zshrs', 'zshrs Language Server', serverOptions, clientOptions);

  client.start().catch((err) => {
    vscode.window.showWarningMessage(
      `zshrs language server failed to start (${command} --lsp): ${err.message}. Syntax highlighting still works.`
    );
  });

  context.subscriptions.push({ dispose: stopClient });
}

// stop() throws synchronously unless the client is actually Running — in the
// Starting / StartFailed states it raises "Client is not running and can't be
// stopped". Only stop a running client, and swallow any late rejection.
function stopClient() {
  if (!client || !client.isRunning()) {
    return undefined;
  }
  try {
    return Promise.resolve(client.stop()).catch(() => undefined);
  } catch (_e) {
    return undefined;
  }
}

function deactivate() {
  for (const b of bridges.values()) { b.dispose(); }
  bridges.clear();
  return stopClient();
}

module.exports = { activate, deactivate };
