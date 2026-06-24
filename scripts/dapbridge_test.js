// End-to-end test for the connect-back DAP bridge (lib/dapBridge.js) against the
// real `zshrs --dap`. zshrs dials INTO our listener; VS Code (simulated here by a
// plain TCP client) connects to the same port; the bridge pipes them. We send a
// DAP `initialize` as "VS Code" and assert zshrs's response comes back through
// the pipe.
//
// Skips when the zshrs binary isn't available (e.g. the CI Linux runner). The
// bridge's pure wiring is also exercised by the harness regardless.

const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('net');
const { startDapBridge } = require('../lib/dapBridge');
const { resolveZshrsBinary } = require('../lib/resolveBinary');

const zshrs = resolveZshrsBinary('zshrs');

test('bridge pipes DAP initialize between a client and real zshrs --dap', { skip: zshrs ? false : 'zshrs binary not found' }, async () => {
  const { port, dispose } = await startDapBridge(zshrs, () => {});
  try {
    const got = await new Promise((resolve, reject) => {
      const client = net.connect(port, '127.0.0.1');
      let buf = Buffer.alloc(0);
      const timer = setTimeout(() => reject(new Error('no DAP response within 4s')), 4000);
      client.on('error', reject);
      client.on('connect', () => {
        const body = Buffer.from(JSON.stringify({ seq: 1, type: 'request', command: 'initialize', arguments: { adapterID: 'zshrs', linesStartAt1: true } }));
        client.write('Content-Length: ' + body.length + '\r\n\r\n');
        client.write(body);
      });
      client.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        const i = buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        const len = parseInt(/Content-Length: (\d+)/.exec(buf.slice(0, i).toString())[1], 10);
        if (buf.length < i + 4 + len) return;
        clearTimeout(timer);
        client.destroy();
        resolve(JSON.parse(buf.slice(i + 4, i + 4 + len).toString()));
      });
    });
    assert.equal(got.type, 'response');
    assert.equal(got.command, 'initialize');
    assert.equal(got.success, true);
    assert.equal(got.body.supportsConfigurationDoneRequest, true);
  } finally {
    dispose();
  }
});
