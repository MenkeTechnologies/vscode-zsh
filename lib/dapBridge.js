// Connect-back DAP bridge for zshrs.
//
// Unlike a stdio debug adapter, `zshrs --dap HOST:PORT` is a TCP *client*: it
// dials INTO a listener the IDE provides (that's how it already works in
// JetBrains). VS Code, on the other hand, wants to be the client (it connects
// to a DebugAdapterServer). So we run a tiny rendezvous server: both VS Code and
// zshrs connect to it, and we pipe the two sockets together so DAP traffic flows
// VS Code <-> zshrs transparently.
//
// vscode-free so it can be unit-tested against the real `zshrs --dap` in CI.

const net = require('net');
const { spawn } = require('child_process');

// Start the bridge. Resolves to `{ port, dispose }` once the listener is up and
// `zshrs --dap 127.0.0.1:<port>` has been spawned. Have VS Code connect to
// `port` (via DebugAdapterServer); the two inbound sockets (VS Code + zshrs) are
// piped. `onError` is invoked if zshrs fails to spawn.
function startDapBridge(command, onError) {
  return new Promise((resolve, reject) => {
    const peers = [];
    let proc;

    const server = net.createServer((socket) => {
      socket.on('error', () => {});
      peers.push(socket);
      if (peers.length === 2) {
        // Symmetric: whichever is VS Code and whichever is zshrs, piping both
        // directions makes the DAP stream flow end to end.
        peers[0].pipe(peers[1]);
        peers[1].pipe(peers[0]);
        server.close(); // stop accepting; the two live sockets stay open
      }
    });

    const dispose = () => {
      try { if (proc) proc.kill(); } catch (_e) { /* already gone */ }
      try { server.close(); } catch (_e) { /* already closed */ }
      for (const s of peers) { try { s.destroy(); } catch (_e) { /* already destroyed */ } }
    };

    server.on('error', (e) => { dispose(); reject(e); });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      proc = spawn(command, ['--dap', `127.0.0.1:${port}`], { stdio: ['ignore', 'ignore', 'pipe'] });
      proc.on('error', (e) => { dispose(); if (onError) onError(e); });
      resolve({ port, dispose });
    });
  });
}

module.exports = { startDapBridge };
