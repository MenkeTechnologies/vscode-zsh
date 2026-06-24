// Pure (vscode-free) resolver for the zshrs binary, so it can be unit-tested in
// CI without the `vscode` module.
//
// When launched from the macOS Dock / Finder (or a desktop launcher on Linux),
// the editor's process does NOT inherit the shell PATH, so a bare `zshrs` fails
// to spawn — which kills the language server and the debugger. The fix is to
// resolve to an absolute path (or refuse to start when the binary is missing).

const fs = require('fs');
const path = require('path');
const os = require('os');

// Install locations a non-login GUI process commonly misses (zshrs ships via
// cargo and Homebrew, so ~/.cargo/bin and /opt/homebrew/bin matter most).
function defaultFallbackDirs() {
  return [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    path.join(os.homedir(), '.cargo', 'bin'),
    path.join(os.homedir(), '.local', 'bin')
  ];
}

// Resolve `configured` (the `zshrs.path` setting, default "zshrs") to an
// absolute, executable path. Returns undefined if it can't be found.
// `fallbackDirs` is injectable so the GUI-PATH behavior is unit-testable.
function resolveZshrsBinary(configured, fallbackDirs = defaultFallbackDirs()) {
  // An explicit path (contains a separator) — verify it's executable, use as-is.
  if (configured.includes(path.sep) || configured.includes('/')) {
    try {
      fs.accessSync(configured, fs.constants.X_OK);
      return configured;
    } catch (_e) {
      return undefined;
    }
  }

  // Bare command name — search PATH plus the GUI-missed fallback locations.
  const dirs = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  dirs.push(...fallbackDirs);

  const seen = new Set();
  for (const dir of dirs) {
    const candidate = path.join(dir, configured);
    if (seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch (_e) {
      // keep looking
    }
  }
  return undefined;
}

module.exports = { resolveZshrsBinary, defaultFallbackDirs };
