// Tokenize a zshrs sample with the real VS Code grammar engine
// (vscode-textmate + vscode-oniguruma) and assert key scopes. Verifies the
// generated grammar actually loads under oniguruma and classifies tokens.
const fs = require('fs');
const path = require('path');
const vsctm = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const root = path.join(__dirname, '..');
const wasm = fs.readFileSync(path.join(root, 'node_modules/vscode-oniguruma/release/onig.wasm'));
const onigLib = oniguruma.loadWASM(wasm.buffer).then(() => ({
  createOnigScanner: (s) => new oniguruma.OnigScanner(s),
  createOnigString: (s) => new oniguruma.OnigString(s)
}));

const registry = new vsctm.Registry({
  onigLib,
  loadGrammar: () =>
    Promise.resolve(
      vsctm.parseRawGrammar(
        fs.readFileSync(path.join(root, 'syntaxes/zshrs.tmLanguage.json'), 'utf8'),
        'zshrs.tmLanguage.json'
      )
    )
});

const lines = [
  '#!/usr/bin/env zsh',
  'typeset -A map',
  'for f in *.zsh; do',
  '    bindkey "^R" history-search',
  '    local out=$(base64 -i "$f")',
  '    echo "got $out"',
  'done'
];

// (lineIndex, columnIndex) -> required scope substring
const checks = [
  [1, 0, 'storage.modifier', 'typeset'],
  [2, 0, 'keyword.control', 'for'],
  [3, 4, 'support.function.builtin', 'bindkey'],
  [3, 12, 'string.quoted.double', '"^R"'],
  [4, 17, 'support.function.extension', 'base64'],
  [5, 9, 'string.quoted.double', '"got'],
  [5, 14, 'variable', '$out']
];

registry.loadGrammar('source.zshrs').then((grammar) => {
  let ruleStack = vsctm.INITIAL;
  const tokensPerLine = lines.map((line) => {
    const r = grammar.tokenizeLine(line, ruleStack);
    ruleStack = r.ruleStack;
    return r.tokens;
  });

  let failed = 0;
  for (const [li, col, wantScope, label] of checks) {
    const toks = tokensPerLine[li];
    const tok = toks.find((t) => col >= t.startIndex && col < t.endIndex);
    const scopes = tok ? tok.scopes.join(' ') : '(none)';
    const ok = scopes.includes(wantScope);
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  L${li}c${col} ${label.padEnd(10)} want=${wantScope.padEnd(28)} got=${scopes}`);
  }
  console.log(failed === 0 ? '\nALL TOKEN CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
}).catch((e) => { console.error(e); process.exit(2); });
