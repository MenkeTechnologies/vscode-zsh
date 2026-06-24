# Changelog

## 0.2.0

- Add **running**: `zshrs: Run File` command (Ctrl+F5, editor-title ▶, command
  palette) saves and runs the active zsh script as `zshrs <file>` in a terminal.
- Add **debugging** via zshrs's native debug adapter (`zshrs --dap`): gutter
  breakpoints, step over/into/out, call stack, scopes, variables, watch /
  hover-to-evaluate. F5 on a zsh script works with no `launch.json`; launch
  attributes `program`/`args`/`cwd`/`stopOnEntry`/`zshrsPath` are supported.
  zshrs's DAP is connect-back (it dials into the IDE's listener, as in
  JetBrains); the extension runs that listener, spawns `zshrs --dap
  127.0.0.1:<port>`, and bridges it to VS Code's debugger.
- Harden the language server: resolve the `zshrs` binary to an absolute path
  (PATH + `~/.cargo/bin`, `/opt/homebrew/bin`, …) so it works under the macOS
  GUI `$PATH`; spawn bare `zshrs --lsp` (no `--stdio`); and only stop the client
  when it's running. The adapter binary is resolved the same way.

## 0.1.0

- Initial release.
- Filetype detection for zsh dotfiles (`.zshrc`, `.zshenv`, `.zprofile`,
  `.zlogin`, `.zlogout`, `.zpreztorc`), `*.zsh` / `*.zsh-theme` files, and
  zsh / zshrs shebangs.
- Standalone TextMate grammar (`source.zshrs`) generated from the zshrs
  binary's reflection tables (`zshrs --dump-reflection`) — builtins,
  the zshrs world-first extensions (their own scope), special variables,
  control / declaration keywords, sigils, strings, here-docs, command
  substitution, numbers, operators, pipes, and redirects.
- Language server integration via `zshrs --lsp` (vscode-languageclient).
