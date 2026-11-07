/*
 * Launcher for TM BT LED - auto-detects running games
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const { getProcesses } = require("node-processlist");
const { getSupportedGames, getGlobalSettings } = require("./configLoader.js");
const { parseArgs } = require("./cli.js");
const { printValidFpsOptions } = require("./bleTiming.js");
const { onShutdown, shutdown } = require("./shutdown.js");

const globalSettings = getGlobalSettings();
const argv = parseArgs(undefined, globalSettings);

if (argv.showFps || argv.listFps) {
    printValidFpsOptions();
    process.exit(0);
}

if (argv.installDriver || argv.restoreDriver) {
    const { installDriver, restoreDriver } = require("./driverInstaller.js");
    (argv.installDriver ? installDriver() : restoreDriver())
        .then(code => process.exit(code))
        .catch((e) => {
            console.error(e?.message || e);
            process.exit(1);
        });
    return;
}

const {TmBTLed, Setup} = require("./tmBTLed.js");

const supportedGames = getSupportedGames();
const GAME_POLL_INTERVAL_MS = 2500;
const MAX_UNCAUGHT_ERRORS = 20;
const UNCAUGHT_ERROR_WINDOW_MS = 10000;

const excludedTasks = ["svchost.exe", "explorer.exe", "chrome.exe", "runtimebroker.exe", "conhost.exe", "csrss.exe", "cmd.exe", "wininit.exe", "winlogon.exe", "dllhost.exe", "services.exe"];

let deviceReady = false;
let recentUncaughtErrors = [];

// Errors before the device is ready (e.g. no compatible Bluetooth adapter) are fatal; later ones are
// logged and tolerated unless they repeat so quickly that the process is clearly stuck in a loop.
process.on('uncaughtException', (error) => {
    console.error("Unexpected error:", error);
    if (!deviceReady) {
        console.error("\nStartup failed. Check that the Bluetooth stick uses the WinUSB driver (run tm-bt-led.exe --installDriver) and that no other instance is running.");
        shutdown("fatal error", 1);
        return;
    }
    const now = Date.now();
    recentUncaughtErrors = recentUncaughtErrors.filter(t => now - t < UNCAUGHT_ERROR_WINDOW_MS);
    recentUncaughtErrors.push(now);
    if (recentUncaughtErrors.length >= MAX_UNCAUGHT_ERRORS) {
        console.error(`${MAX_UNCAUGHT_ERRORS} errors within ${UNCAUGHT_ERROR_WINDOW_MS / 1000}s, giving up.`);
        shutdown("repeated errors", 1);
    }
});

process.on('unhandledRejection', (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

function buildLedOptions(args) {
    return {
        fps: args.fps,
        interval: args.interval,
        queueDepth: args.queueDepth,
        debug: args.debug,
        legacyTimer: args.legacyTimer,
        metric: args.metric,
        imperial: args.imperial
    };
}

class Launcher {
    runningGame = undefined; 
    currentClient = null;
    gameWatchTimeout = null;

    tmBtLed;

    constructor() {
        if (argv.game) {
            this.runningGame = supportedGames.find(game => game.name === argv.game) || null;
            if (!this.runningGame) {
                console.error(`Unknown game "${argv.game}". Supported: ${supportedGames.map(g => g.name).join(", ")}`);
            }
            this.tmBtLed = new TmBTLed(this.runStandalone, buildLedOptions(argv));
        } else {
            this.tmBtLed = new TmBTLed(this.watchForGameChanges, buildLedOptions(argv));
        }
        onShutdown(this.stop);
    }

    runStandalone = () => {
        deviceReady = true;
        if (this.runningGame) {
            this.handleGameChange();
        }
    }

    watchForGameChanges = async () => {
        deviceReady = true;
        try {
            const runningGame = await this.detectRunningGame();
            if (runningGame !== this.runningGame) {
                this.runningGame = runningGame;
                this.handleGameChange();
            }
        } catch (e) {
            console.error("Game detection failed:", e?.message || e);
        } finally {
            this.gameWatchTimeout = setTimeout(this.watchForGameChanges, GAME_POLL_INTERVAL_MS);
        }
    }

    detectRunningGame = async () => {
        const tasks = await getProcesses();
        tasks.sort((a,b) => a.memUsage === b.memUsage ? 0 : (a.memUsage < b.memUsage) ? -1 : 1);
        const taskNames = tasks.map(t => t.name.toLowerCase()).filter(n => !excludedTasks.includes(n));
        for (const task of taskNames) {
            const game = supportedGames.find(g => g.bin.includes(task));
            if (game) {
                return game;
            }
        }
        return null;
    }

    stopCurrentClient = () => {
        if (!this.currentClient) {
            return;
        }
        try {
            this.currentClient.stopClient();
        } catch (e) {
            console.error("Error while stopping client:", e?.message || e);
        }
        this.currentClient = null;
    }

    stop = () => {
        if (this.gameWatchTimeout) {
            clearTimeout(this.gameWatchTimeout);
            this.gameWatchTimeout = null;
        }
        this.stopCurrentClient();
    }

    handleGameChange = () => {
        this.stopCurrentClient();
        this.tmBtLed.reset();

        if (!this.runningGame) {
            console.log("No game running");
            if (argv.messagelights) {
                this.tmBtLed.setAllColors(true);
                this.tmBtLed.setRevLights(100);
            }
            if (argv.message) {
                this.tmBtLed.setPerformanceMode();
                this.tmBtLed.showTicker(argv.message);
            } else {
                this.tmBtLed.showTemporary("NO  GAME");
                this.tmBtLed.setPowerSaveMode();
            }
            return;
        }

        console.log("Detected game:", this.runningGame.name.toUpperCase());

        this.tmBtLed.showTemporary(this.runningGame.title[0], this.runningGame.title[1]);
        this.tmBtLed.setPerformanceMode();

        try {
            const Client = require("../clients/" + this.runningGame.name + ".js");
            this.currentClient = new Client(this.tmBtLed);
            this.currentClient.startClient();
        } catch (e) {
            console.error(`Could not start client for ${this.runningGame.name}:`, e);
            this.stopCurrentClient();
            this.tmBtLed.showTemporary(" ERR", this.runningGame.name.substring(0, 4).toUpperCase(), 10000);
        }
    }
}

class Test {
    revReversed = false;
    revPercent = 0;
    tmbtled;

    constructor () {
        this.tmbtled = new TmBTLed(this.start, buildLedOptions(argv));
    }

    start = () => {
        deviceReady = true;
        this.tmbtled.setPerformanceMode();
        setInterval(() => {
            this.tmbtled.setRpm(Math.floor(Math.random() * 14001));
            this.tmbtled.setTime(Math.floor(Math.random() * 5001), true);
            this.tmbtled.setGear(Math.floor(Math.random() * 10));
            if (this.revReversed) {
                this.revPercent -= 3;
                if (this.revPercent < 0) {
                    this.revReversed = !this.revReversed;
                }
            } else {
                this.revPercent += 3;
                if (this.revPercent > 100) {
                    this.revReversed = !this.revReversed;
                }
            }
            this.tmbtled.setRevLightsWithoutBlue(this.revPercent);
            this.tmbtled.setAllFlashing(true);

            this.tmbtled.setRevLightsBlueFlashing(true);
        }, 1000 / 60);
    }
}

if (argv.test) {
    new Test();
} else if (argv.setup) {
    new Setup();
} else {
    new Launcher();
}
