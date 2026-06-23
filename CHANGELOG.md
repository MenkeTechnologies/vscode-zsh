# Changelog

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
