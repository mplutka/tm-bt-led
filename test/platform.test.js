const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { filterGamesForPlatform, configureHciEnvironment, isClientSupported } = require('../lib/platform.js');
const { parseProcessName, getLinuxProcesses } = require('../lib/processList.js');

const games = ['f1', 'assetto', 'iracing', 'rF2', 'raceroom', 'ets2', 'dirt', 'wrc'].map(name => ({ name, bin: [] }));

test('all games stay available on Windows', () => {
  assert.deepEqual(filterGamesForPlatform(games, 'win32'), games);
});

test('shared memory games are dropped on Linux', () => {
  assert.deepEqual(filterGamesForPlatform(games, 'linux').map(g => g.name), ['f1', 'dirt', 'wrc']);
  assert.equal(isClientSupported('iracing', 'linux'), false);
  assert.equal(isClientSupported('iracing', 'win32'), true);
});

test('HCI environment is left untouched on Windows', () => {
  const env = {};
  configureHciEnvironment(env, { hciDeviceId: 1 }, 'win32');
  assert.deepEqual(env, {});
});

test('HCI user channel and device id are set on Linux', () => {
  const env = {};
  configureHciEnvironment(env, { hciDeviceId: 1 }, 'linux');
  assert.deepEqual(env, { HCI_CHANNEL_USER: '1', NOBLE_HCI_DEVICE_ID: '1' });
});

test('invalid hciDeviceId falls back to hci0 and existing env wins', () => {
  const env = {};
  configureHciEnvironment(env, { hciDeviceId: 'abc' }, 'linux');
  assert.equal(env.NOBLE_HCI_DEVICE_ID, '0');

  const preset = { HCI_CHANNEL_USER: 'yes', NOBLE_HCI_DEVICE_ID: '2' };
  configureHciEnvironment(preset, { hciDeviceId: 1 }, 'linux');
  assert.deepEqual(preset, { HCI_CHANNEL_USER: 'yes', NOBLE_HCI_DEVICE_ID: '2' });
});

test('process names are parsed from Linux and Proton command lines', () => {
  assert.equal(parseProcessName('Z:\\home\\me\\Steam\\F1 25\\F1_25.exe\0-dx12\0'), 'F1_25.exe');
  assert.equal(parseProcessName('/usr/bin/wine64\0C:\\Games\\LFS\\LFS.exe\0'), 'LFS.exe');
  assert.equal(parseProcessName('/usr/lib/firefox/firefox\0--new-window\0'), 'firefox');
  assert.equal(parseProcessName('', 'kworker/0:1\n'), 'kworker/0:1');
});

test('Linux process list reads /proc style folders', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-bt-led-proc-'));
  try {
    fs.mkdirSync(path.join(dir, '42'));
    fs.writeFileSync(path.join(dir, '42', 'cmdline'), 'Z:\\games\\WRC.exe\0');
    fs.mkdirSync(path.join(dir, '43'));
    fs.writeFileSync(path.join(dir, '43', 'comm'), 'bash\n');
    fs.mkdirSync(path.join(dir, 'self'));
    const names = (await getLinuxProcesses(dir)).map(p => p.name).sort();
    assert.deepEqual(names, ['WRC.exe', 'bash']);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
