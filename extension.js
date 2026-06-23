// vscode-zsh — activates the zshrs language server (zshrs --lsp).
//
// Syntax highlighting and filetype detection are declarative (see package.json
// + syntaxes/zshrs.tmLanguage.json) and need no code. This module only wires
// up the language client so diagnostics / hover / completion work when the
// `zshrs` binary is on PATH. Flags verified against `zshrs --help`:
//   --lsp   Language Server (JSON-RPC on stdio); must be the only arg after zshrs

const vscode = require('vscode');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

let client;

function activate(context) {
  const config = vscode.workspace.getConfiguration('zshrs');
  if (!config.get('lsp.enabled', true)) {
    return;
  }

  const command = config.get('path', 'zshrs');
  const args = config.get('lsp.args', ['--lsp']);

  const serverOptions = {
    run: { command, args, transport: TransportKind.stdio },
    debug: { command, args, transport: TransportKind.stdio }
  };

  const clientOptions = {
    documentSelector: [{ scheme: 'file', language: 'zshrs' }],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.zsh')
    }
  };

  client = new LanguageClient(
    'zshrs',
    'zshrs Language Server',
    serverOptions,
    clientOptions
  );

  // start() rejects if the binary is missing; surface it once, non-fatally.
  client.start().catch((err) => {
    vscode.window.showWarningMessage(
      `zshrs language server failed to start (${command} --lsp): ${err.message}. ` +
      `Set "zshrs.path" or disable "zshrs.lsp.enabled". Syntax highlighting still works.`
    );
  });

  context.subscriptions.push({ dispose: () => client && client.stop() });
}

function deactivate() {
  return client ? client.stop() : undefined;
}

module.exports = { activate, deactivate };
