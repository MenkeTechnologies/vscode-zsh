#!/usr/bin/env bash
# Tokenize a zshrs sample with the real VS Code grammar engine and assert
# key scopes. Requires `npm install` (vscode-textmate + vscode-oniguruma).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
if [[ ! -d node_modules/vscode-textmate || ! -d node_modules/vscode-oniguruma ]]; then
    echo "SKIP  node_modules/vscode-textmate missing — run 'npm install' first"
    exit 0
fi
node scripts/tokenize_test.js
