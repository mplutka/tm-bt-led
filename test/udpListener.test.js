const test = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('dgram');
const UdpListener = require('../lib/udpListener.js');

test('a busy port emits listenerError instead of crashing', async () => {
  const blocker = dgram.createSocket('udp4');
  await new Promise((resolve) => blocker.bind(0, '0.0.0.0', resolve));
  const port = blocker.address().port;

  const originalError = console.error;
  console.error = () => {};
  const listener = new UdpListener({ port });
  try {
    const err = await new Promise((resolve) => {
      listener.once('listenerError', resolve);
      listener.start();
    });
    assert.equal(err.code, 'EADDRINUSE');
    assert.match(UdpListener.describeSocketError(err, port), /already in use/);
  } finally {
    console.error = originalError;
    listener.stop();
    blocker.close();
  }
});

test('exceptions in data handlers do not escape parseMessage', () => {
  const originalError = console.error;
  console.error = () => {};
  const listener = new UdpListener({ port: 0 });
  try {
    listener.on('data', () => { throw new Error('bad packet'); });
    assert.doesNotThrow(() => listener.parseMessage(Buffer.from([1, 2, 3])));
  } finally {
    console.error = originalError;
    listener.stop();
  }
});
