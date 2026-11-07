/*
 * Command line parsing for tm-bt-led.exe
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

const yargs = require("yargs");
const { hideBin } = require('yargs/helpers');

function parseArgs(argvList = hideBin(process.argv), globalSettings = {}) {
    return yargs(argvList)
        .scriptName('tm-bt-led.exe')
        .usage('Usage: tm-bt-led.exe [options]')
        .option('fps', {
            type: 'number',
            description: 'Target FPS (auto-converts to valid BLE interval)',
            default: globalSettings.fps
        })
        .option('interval', {
            type: 'number',
            description: 'Target interval in ms (rounds to valid BLE interval)'
        })
        .option('queueDepth', {
            type: 'number',
            description: 'Max pending BLE writes (1-5)',
            default: globalSettings.queueDepth
        })
        .option('debug', {
            type: 'boolean',
            description: 'Show detailed stats every 2 seconds',
            default: globalSettings.debug
        })
        .option('legacyTimer', {
            type: 'boolean',
            description: 'Use setInterval instead of high-resolution timer',
            default: false
        })
        .option('listFps', {
            alias: 'showFps',
            type: 'boolean',
            description: 'Show all valid FPS/interval combinations and exit'
        })
        .option('metric', {
            type: 'boolean',
            description: 'Force metric units (km/h, kg, C)',
            default: globalSettings.metric || undefined
        })
        .option('imperial', {
            type: 'boolean',
            description: 'Force imperial units (mph, lb, F)',
            default: globalSettings.imperial || undefined
        })
        .option('game', {
            type: 'string',
            description: 'Force specific game client (e.g., assetto, f1, iracing)'
        })
        .option('test', {
            type: 'boolean',
            description: 'Run in test/demo mode'
        })
        .option('setup', {
            type: 'boolean',
            description: 'Run device setup/pairing mode'
        })
        .option('installDriver', {
            type: 'boolean',
            description: 'Switch the Bluetooth stick to the WinUSB driver and exit'
        })
        .option('restoreDriver', {
            type: 'boolean',
            description: 'Give the Bluetooth stick back to the Windows Bluetooth driver and exit'
        })
        .option('message', {
            type: 'string',
            description: 'Display scrolling message when no game running',
            default: globalSettings.message || undefined
        })
        .option('messagelights', {
            type: 'boolean',
            description: 'Enable all LEDs when no game running'
        })
        .example('tm-bt-led.exe --fps=60', 'Run at 60 FPS (16.25ms interval)')
        .example('tm-bt-led.exe --fps=80 --queueDepth=3', 'High performance mode')
        .example('tm-bt-led.exe --debug', 'Show detailed BLE stats')
        .example('tm-bt-led.exe --installDriver', 'One-time setup of the Bluetooth stick')
        .example('tm-bt-led.exe --listFps', 'Show all valid FPS options')
        .example('tm-bt-led.exe --game=assetto', 'Force Assetto Corsa client')
        .epilog('BLE intervals must be multiples of 1.25ms. Use --listFps to see valid options.')
        .strict()
        .help()
        .parse();
}

module.exports = { parseArgs };
