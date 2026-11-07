const test = require('node:test');
const assert = require('node:assert/strict');
const {
  toValidBleInterval, fpsToInterval, resolveTargetInterval, clampQueueDepth
} = require('../lib/bleTiming.js');
const { resolveMaxRpmForRevLights } = require('../lib/resolveMaxRpm.js');
const {
  normalizeAdditionalUsbVidPids, resolveOutputHandle, WriteQueue
} = require('../lib/tmBTLed.js');

test('BLE intervals snap to 1.25 ms steps with a 7.5 ms minimum', () => {
  assert.equal(toValidBleInterval(16.6), 16.25);
  assert.equal(toValidBleInterval(1), 7.5);
  assert.equal(fpsToInterval(60), 16.25);
  assert.equal(fpsToInterval(80), 12.5);
  assert.equal(resolveTargetInterval({}), 16.25);
  assert.equal(resolveTargetInterval({ interval: 20 }), 20);
  assert.equal(resolveTargetInterval({ fps: 50, interval: 30 }), 20);
});

test('queue depth is clamped to 1..5', () => {
  assert.equal(clampQueueDepth(0), 1);
  assert.equal(clampQueueDepth(9), 5);
  assert.equal(clampQueueDepth(undefined), 2);
  assert.equal(clampQueueDepth(3.4), 3);
});

test('resolveMaxRpm prefers valid game data, then config fallback, then learned peak', () => {
  assert.equal(resolveMaxRpmForRevLights({ telemetryMaxRpm: 8000, currentRpm: 3000 }, { detectedMaxRpm: 5000 }), 8000);
  assert.equal(resolveMaxRpmForRevLights({ telemetryMaxRpm: 0, fallbackMaxRpm: 7500 }, { detectedMaxRpm: 5000 }), 7500);
  assert.equal(resolveMaxRpmForRevLights({ telemetryMaxRpm: null }, { detectedMaxRpm: 5000 }), 5000);

  const state = { detectedMaxRpm: 5000 };
  assert.equal(resolveMaxRpmForRevLights({ telemetryMaxRpm: 8000, currentRpm: 8400 }, state), 8400);
  assert.equal(state.detectedMaxRpm, 8400);
});

test('additional USB VID/PID entries accept numbers and hex strings', () => {
  assert.deepEqual(
    normalizeAdditionalUsbVidPids([
      { vid: '0x0BDA', pid: '0x8771' },
      { vid: 2652, pid: 34614 },
      { vid: 'nope', pid: 1 },
      null
    ]),
    [{ vid: 0x0bda, pid: 0x8771 }, { vid: 2652, pid: 34614 }]
  );
  assert.deepEqual(normalizeAdditionalUsbVidPids(undefined), []);
});

test('output handle: override, then 58, then last writable HID report', () => {
  const report = (valueHandle, props = ['read', 'writeWithoutResponse']) =>
    ({ uuid: '2a4d', valueHandle, propsDecoded: props });

  assert.equal(resolveOutputHandle(null), 58);
  assert.equal(resolveOutputHandle(null, '70'), 70);
  assert.equal(resolveOutputHandle({ characteristics: { 1812: [report(51, ['read', 'notify']), report(58)] } }), 58);
  assert.equal(resolveOutputHandle({ characteristics: { 1812: [report(40), report(44), report(51, ['notify'])] } }), 44);
});

test('WriteQueue limits pending writes and releases stuck slots', () => {
  const queue = new WriteQueue(2);
  assert.equal(queue.canWrite(0), true);
  queue.startWrite(0);
  queue.startWrite(0);
  assert.equal(queue.canWrite(10), false);

  queue.endWrite();
  assert.equal(queue.canWrite(Date.now()), true);

  queue.startWrite();
  const later = queue.lastProgressTime + WriteQueue.STUCK_TIMEOUT_MS + 1;
  queue.canWrite(later);
  assert.equal(queue.pendingWrites, 0);
  assert.equal(queue.getStats().errors, 1);
});
