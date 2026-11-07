const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const configLoader = require('../lib/configLoader.js');

function withAppDir(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-bt-led-'));
  const previous = process.env.TM_BT_LED_HOME;
  try {
    for (const [name, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dir, name), content);
    }
    process.env.TM_BT_LED_HOME = dir;
    configLoader.resetConfigCache();
    return fn(dir);
  } finally {
    if (previous === undefined) {
      delete process.env.TM_BT_LED_HOME;
    } else {
      process.env.TM_BT_LED_HOME = previous;
    }
    configLoader.resetConfigCache();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('app dir comes from TM_BT_LED_HOME', () => {
  withAppDir({}, (dir) => {
    assert.equal(configLoader.getAppDir(), path.resolve(dir));
    assert.equal(configLoader.resolveAppPath('x.dump'), path.join(path.resolve(dir), 'x.dump'));
  });
});

test('config.json entries are merged over client defaults', () => {
  const config = { iracing: { leftModes: ['RPM'] }, global: { fps: 50 } };
  withAppDir({ 'config.json': JSON.stringify(config) }, () => {
    const iracing = configLoader.getClientConfig('iracing', 'iracing.config.js');
    assert.deepEqual(iracing.leftModes, ['RPM']);
    assert.deepEqual(iracing.rightModes, configLoader.getDefaultConfig('iracing').rightModes);
    assert.equal(iracing.fallbackMaxRpm, 7500);

    const settings = configLoader.getGlobalSettings();
    assert.equal(settings.fps, 50);
    assert.equal(settings.queueDepth, 2);
  });
});

test('legacy per-game config files still work', () => {
  const legacy = 'module.exports = { leftModes: ["SPEED"], rightModes: ["LAP"] };';
  withAppDir({ 'rf2.config.js': legacy }, () => {
    const rf2 = configLoader.getClientConfig('rF2', 'rf2.config.js');
    assert.deepEqual(rf2.leftModes, ['SPEED']);
    assert.deepEqual(rf2.rightModes, ['LAP']);
  });
});

test('invalid config.json falls back to defaults', () => {
  withAppDir({ 'config.json': '{ broken' }, () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      assert.deepEqual(configLoader.getClientConfig('f1'), configLoader.getDefaultConfig('f1'));
    } finally {
      console.error = originalError;
    }
  });
});

test('ATS is detected alongside ETS2', () => {
  const ets2 = configLoader.getSupportedGames().find((game) => game.name === 'ets2');
  assert.ok(ets2.bin.includes('amtrucks.exe'));
});
