const test = require('node:test');
const assert = require('node:assert/strict');

const { supportedVidPidIds, isHciCandidate } = require('../lib/driverInstaller.js');

test('supported sticks are formatted like Windows instance IDs, including configured extras', () => {
  const ids = supportedVidPidIds([{ vid: '0x1234', pid: 43981 }, { vid: 'bad' }]);
  assert.ok(ids.includes('VID_0A12&PID_0001'));
  assert.equal(ids[ids.length - 1], 'VID_1234&PID_ABCD');
  assert.ok(!ids.some(id => id.includes('NaN')));
});

test('only the HCI interface of composite radios is a driver candidate', () => {
  assert.equal(isHciCandidate({ iface: null, service: 'BTHUSB' }), true);
  assert.equal(isHciCandidate({ iface: null, service: 'usbccgp' }), false);
  assert.equal(isHciCandidate({ iface: '00', service: 'BTHUSB' }), true);
  assert.equal(isHciCandidate({ iface: '01', service: 'BTHUSB' }), false);
});
