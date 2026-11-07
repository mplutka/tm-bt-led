const test = require('node:test');
const assert = require('node:assert/strict');
const { TmBTLedDisplay, resolveUnits, packBits, FRAME_BYTES } = require('../lib/display.js');

function createDisplay(options = {}) {
  const display = new TmBTLedDisplay({ quiet: true, locale: 'de-DE', ...options });
  const shown = [];
  const original = display.updateDisplay;
  display.updateDisplay = (str, right) => {
    shown.push(str);
    original(str, right);
  };
  return { display, shown };
}

function bitsOn(display, start, end) {
  return display.bitArray.slice(start, end + 1).join('');
}

test('setTime formats lap times for the 4-digit display', () => {
  const { display, shown } = createDisplay();
  display.setTime(5123);
  display.setTime(45678);
  display.setTime(83456);
  display.setTime(754000);
  display.setTime(100 * 60 * 1000);
  assert.deepEqual(shown, ['5.123', '45.67', '1.23.4', '1234', '9999']);
});

test('setTime pads milliseconds below 100', () => {
  const { display, shown } = createDisplay();
  display.setTime(61005);
  display.setTime(12050);
  assert.deepEqual(shown, ['1.01.0', '12.05']);
});

test('setTime shows dashes for missing times', () => {
  const { display, shown } = createDisplay();
  display.setTime(0);
  display.setTime(null);
  display.setTime(NaN);
  display.setTime(2147483647);
  assert.deepEqual(shown, ['----', '----', '----', '----']);
});

test('setDiffTime formats signed deltas', () => {
  const { display, shown } = createDisplay();
  display.setDiffTime(-1234);
  display.setDiffTime(12345);
  display.setDiffTime(150000);
  display.setDiffTime(null);
  assert.deepEqual(shown, ['-1.23', '+12.3', '+99.9', '----']);
});

test('setNumber attaches the decimal point to the preceding digit', () => {
  const { display } = createDisplay();
  const [char3Start] = TmBTLedDisplay.BitRanges.leftChar3;
  const [char4Start] = TmBTLedDisplay.BitRanges.leftChar4;
  display.setNumber('1.2');
  assert.equal(display.bitArray[char3Start + 9], 1);
  assert.equal(display.bitArray[char4Start + 9], 0);
});

test('setRevLights fills both rev bars from the right', () => {
  const { display } = createDisplay();
  const [r1s, r1e] = TmBTLedDisplay.BitRanges.revLights1;
  const [r2s, r2e] = TmBTLedDisplay.BitRanges.revLights2;

  display.setRevLights(0);
  assert.equal(bitsOn(display, r1s, r1e), '00000000');
  assert.equal(bitsOn(display, r2s, r2e), '0000000');

  display.setRevLights(25);
  assert.equal(bitsOn(display, r1s, r1e), '00001111');
  assert.equal(bitsOn(display, r2s, r2e), '0000000');

  display.setRevLights(50);
  assert.equal(bitsOn(display, r1s, r1e), '11111111');
  assert.equal(bitsOn(display, r2s, r2e), '0000000');

  display.setRevLights(120);
  assert.equal(bitsOn(display, r1s, r1e), '11111111');
  assert.equal(bitsOn(display, r2s, r2e), '1111111');
});

test('setRevLights clamps negative and invalid percentages to off', () => {
  const { display } = createDisplay();
  const [r1s, r1e] = TmBTLedDisplay.BitRanges.revLights1;
  for (const value of [-10, NaN, undefined]) {
    display.setRevLights(value);
    assert.equal(bitsOn(display, r1s, r1e), '00000000');
  }
});

test('getFrame only recomposes when dirty or flashing', () => {
  const { display } = createDisplay();
  const first = Buffer.from(display.getFrame(0));
  assert.equal(display.bufferDirty, false);
  assert.equal(display.needsContinuousRefresh(), false);
  assert.deepEqual(Buffer.from(display.getFrame(250)), first);

  display.setRevLights(100);
  assert.equal(display.bufferDirty, true);
  const changed = Buffer.from(display.getFrame(0));
  assert.notDeepEqual(changed, first);
  assert.equal(changed.length, FRAME_BYTES);
});

test('LED flashing toggles by wall-clock phase without timers', () => {
  const { display } = createDisplay();
  display.setFlashingYellow(true);
  assert.equal(display.needsContinuousRefresh(), true);
  const phaseA = Buffer.from(display.getFrame(0));
  const phaseB = Buffer.from(display.getFrame(500));
  assert.notDeepEqual(phaseA, phaseB);
  assert.deepEqual(Buffer.from(display.getFrame(1000)), phaseA);

  display.setFlashingYellow(false);
  assert.equal(display.needsContinuousRefresh(), false);
  display.dispose();
});

test('packBits packs most significant bit first', () => {
  const out = Buffer.alloc(2);
  packBits([1, 0, 0, 0, 0, 0, 0, 1, 1], out);
  assert.deepEqual([...out], [0x81, 0x80]);
});

test('resolveUnits respects flags and locale', () => {
  assert.equal(resolveUnits({ metric: true, locale: 'en-US' }).speed, 'metric');
  assert.equal(resolveUnits({ imperial: true, locale: 'de-DE' }).temperature, 'imperial');

  const us = resolveUnits({ locale: 'en-US' });
  assert.deepEqual([us.speed, us.temperature, us.weight], ['imperial', 'imperial', 'imperial']);

  const gb = resolveUnits({ locale: 'en-GB' });
  assert.deepEqual([gb.speed, gb.temperature, gb.weight], ['imperial', 'metric', 'metric']);

  const de = resolveUnits({ locale: 'de-DE' });
  assert.deepEqual([de.speed, de.temperature, de.weight], ['metric', 'metric', 'metric']);
});

test('mode buttons map to next/previous callbacks including wrap-around', () => {
  const { display } = createDisplay();
  const calls = [];
  display.setCallbacks({
    onLeftNextMode: () => calls.push('L+'),
    onLeftPreviousMode: () => calls.push('L-'),
    onRightNextMode: () => calls.push('R+'),
    onRightPreviousMode: () => calls.push('R-')
  });
  display.handleEvent([0, 255, 10]);
  display.handleEvent([0, 0, 9]);
  display.handleEvent([0, 255, 10]);
  assert.deepEqual(calls, ['L+', 'R-', 'L-', 'R+']);
});
