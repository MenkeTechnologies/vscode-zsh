```
██╗   ██╗███████╗ ██████╗ ██████╗ ██████╗ ███████╗   ███████╗███████╗██╗  ██╗
██║   ██║██╔════╝██╔════╝██╔═══██╗██╔══██╗██╔════╝   ╚══███╔╝██╔════╝██║  ██║
██║   ██║███████╗██║     ██║   ██║██║  ██║█████╗█████╗ ███╔╝ ███████╗███████║
╚██╗ ██╔╝╚════██║██║     ██║   ██║██║  ██║██╔══╝╚════╝███╔╝  ╚════██║██╔══██║
 ╚████╔╝ ███████║╚██████╗╚██████╔╝██████╔╝███████╗   ███████╗███████║██║  ██║
  ╚═══╝  ╚══════╝ ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝   ╚══════╝╚══════╝╚═╝  ╚═╝
```

[![CI](https://github.com/MenkeTechnologies/vscode-zsh/actions/workflows/ci.yml/badge.svg)](https://github.com/MenkeTechnologies/vscode-zsh/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-online-blue.svg)](https://menketechnologies.github.io/vscode-zsh/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

### `[VS CODE EXTENSION // NEON GRAMMAR // COMPLETE BUILTIN SURFACE // LSP]`

> *"Open a `.zshrc`. The whole shell lights up — every builtin, every world-first extension."*

VS Code / VSCodium support for **[zshrs](https://github.com/MenkeTechnologies/zshrs)** — the first-ever Rust rewrite of zsh: a compiled, JIT'd, massively parallel shell. A standalone TextMate grammar (it owns the `zshrs` language id — not a `shellscript` reskin), filetype detection for zsh dotfiles, and language-server integration via `zshrs --lsp`.

### [`Read the Docs`](https://menketechnologies.github.io/vscode-zsh/) &middot; [`Engineering Report`](https://menketechnologies.github.io/vscode-zsh/report.html) · [`zshrs`](https://github.com/MenkeTechnologies/zshrs) · [`vscode-stryke`](https://github.com/MenkeTechnologies/vscode-stryke)

---

## [0x00] OVERVIEW

**vscode-zsh** is the VS Code / VSCodium extension for **zshrs**. It provides:

- **Filetype detection** — zsh dotfiles (`.zshrc`, `.zshenv`, `.zprofile`, `.zlogin`, `.zlogout`, `.zpreztorc`), `*.zsh` / `*.zsh-theme` files, and files whose first line is a zsh / zshrs shebang (`#!/usr/bin/env zsh`).
- **Syntax highlighting** — a standalone TextMate grammar (`source.zshrs`) with its own language id, so it owns the language rather than reskinning the built-in shell grammar.
- **Language server** — `zshrs --lsp` via [vscode-languageclient](https://github.com/microsoft/vscode-languageserver-node) (diagnostics, hover, completion — whatever the server provides).

The grammar is **generated** (`scripts/gen_grammar.sh`) directly from the zshrs binary's own reflection tables (`zshrs --dump-reflection`), so it carries the language's real surface and never drifts:

- **137 builtins** — `.builtins` keys, minus keyword names, minus extension names
- **113 extensions** — `.extensions` keys, given their **own scope** (the zshrs world-first additions)
- **245 special variables** — `.special_vars` keys

Created by **[MenkeTechnologies](https://github.com/MenkeTechnologies)**.

---

## [0x01] FEATURE MATRIX

| Capability | Status |
|---|---|
| Filetype detection — dotfiles | **Implemented** — `contributes.languages` filenames map |
| Filetype detection — `*.zsh` / `*.zsh-theme` | **Implemented** — `contributes.languages` extension map |
| Filetype detection — shebang | **Implemented** — `firstLine` regex `^#!.*\bzsh\b` |
| Syntax highlighting | **Implemented** — TextMate grammar (`source.zshrs`), own language id |
| Comments / brackets / autoclose | **Implemented** — `language-configuration.json` |
| Indentation | **Implemented** — brace-based `indentationRules` |
| Language server | **Implemented** — `zshrs --lsp` via vscode-languageclient |
| Config | `zshrs.path`, `zshrs.lsp.enabled`, `zshrs.lsp.args` |

> The `zshrs` binary must be on `$PATH` for the language server. Build **[zshrs](https://github.com/MenkeTechnologies/zshrs)** with `cargo build`.

---

## [0x02] INSTALL

This extension is not yet on the Marketplace. Build and install the `.vsix` locally:

```bash
git clone https://github.com/MenkeTechnologies/vscode-zsh
cd vscode-zsh
npm install
npx @vscode/vsce package          # produces vscode-zsh-<version>.vsix
code --install-extension vscode-zsh-*.vsix
```

Or drop the folder into your extensions dir for development:

```bash
git clone https://github.com/MenkeTechnologies/vscode-zsh \
    ~/.vscode/extensions/vscode-zsh
```

Open any `.zshrc` or `.zsh` file — it lights up. The language server starts automatically when `zshrs` is on `$PATH`.

---

## [0x03] SYNTAX // SCOPES

The grammar maps zshrs tokens to standard TextMate scopes, so every VS Code theme colors them:

| Token group | Scope | Sample |
|---|---|---|
| Control flow | `keyword.control.zshrs` | `if` `then` `fi` `for` `while` `case` `esac` `function` `return` |
| Declarations | `storage.modifier.zshrs` | `typeset` `local` `export` `declare` `readonly` `integer` `float` |
| Builtins (137) | `support.function.builtin.zshrs` | `bindkey` `autoload` `zstyle` `compadd` `setopt` `zle` … |
| Extensions (113) | `support.function.extension.zshrs` | `base64` `async` `await` `barrier` `clone` … |
| Special variables (245) | `variable.language.zshrs` | `PATH` `HOME` `PWD` `RANDOM` … |
| Sigil variables | `variable.other.zshrs` | `$foo` `${bar}` `$1` `$?` `$@` `$#` `$$` `$!` `$*` |
| Operators / pipes / redirects | `keyword.operator.zshrs` | `\|` `\|\|` `&&` `;;` `>` `>>` `<<` `>&` `=~` |

Strings (single / double / backtick), here-docs (`<<EOF`, `<<-`, `<<'EOF'`), `$var` / `${...}` interpolation, escapes, command substitution `$(...)`, and numbers are all scoped too.

---

## [0x04] LANGUAGE SERVER

The extension launches `zshrs --lsp` (stdio JSON-RPC) through `vscode-languageclient`. Configure it in Settings:

| Setting | Default | Effect |
|---|---|---|
| `zshrs.path` | `zshrs` | Path to the zshrs executable |
| `zshrs.lsp.enabled` | `true` | Start the language server (set `false` for highlighting only) |
| `zshrs.lsp.args` | `["--lsp"]` | Args passed to start the server |

If the binary is missing, the extension shows one non-fatal warning and syntax highlighting keeps working.

---

## [0x05] REGENERATING THE GRAMMAR

The builtin / extension / special-variable surface is generated from the live binary so it never drifts. After a zshrs upgrade:

```bash
./scripts/gen_grammar.sh        # rewrites syntaxes/zshrs.tmLanguage.json
npm run gen                      # same thing via npm
```

Verify it still tokenizes correctly with the real VS Code grammar engine:

```bash
npm install
node scripts/tokenize_test.js
```

---

## [0x06] LAYOUT

```
vscode-zsh/
├── package.json                    # extension manifest (language, grammar, config, LSP)
├── language-configuration.json     # comments, brackets, autoclose, indent rules
├── extension.js                    # LSP client (zshrs --lsp)
├── syntaxes/zshrs.tmLanguage.json  # generated grammar — builtins, extensions, special vars
├── scripts/gen_grammar.sh          # regenerates the grammar from the zshrs binary
└── scripts/tokenize_test.js        # tokenizes a sample with vscode-textmate + asserts scopes
```

---

## [0x07] LICENSE

MIT © **[MenkeTechnologies](https://github.com/MenkeTechnologies)**
