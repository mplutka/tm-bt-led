/*
 * Launcher for TM BT LED - auto-detects running games
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const { getProcesses } = require("node-processlist");
const {TmBTLed, Setup} = require("./tmBTLed.js");
const { getSupportedGames, getGlobalSettings } = require("./configLoader.js");

const yargs = require("yargs");
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const globalSettings = getGlobalSettings();
const supportedGames = getSupportedGames();

const excludedTasks = ["svchost.exe", "explorer.exe", "chrome.exe", "runtimebroker.exe", "conhost.exe", "csrss.exe", "cmd.exe", "wininit.exe", "winlogon.exe", "dllhost.exe", "services.exe"];

process.on('uncaughtException', function (exception) {
    console.error(exception);
});

class Launcher {
    runningGame = undefined; 
    currentClient = null;
    gameChangeWatcher;

    tmBtLed;

    constructor() {
        if (argv?.game) {
            this.runningGame = supportedGames.find(game => game.name === argv.game) || null;
            this.tmBtLed = new TmBTLed(this.runStandalone.bind(this));
        } else {
            this.tmBtLed = new TmBTLed(this.watchForGameChanges.bind(this));
        }
    }

    runStandalone = () => {
        if (this.runningGame) {
            this.handleGameChange();
        }
    }

    watchForGameChanges = async () => {
        const tasks = await getProcesses();
        tasks.sort((a,b) => a.memUsage === b.memUsage ? 0 : (a.memUsage < b.memUsage) ? -1 : 1);
        const taskNames = tasks.map(t => t.name.toLowerCase()).filter(n => !excludedTasks.includes(n));
        let runningGame = null;
        for (let i = 0; i < taskNames.length; i++) {
            const task = taskNames[i];
            runningGame = supportedGames.find(game => game.bin.map(t => t.toLowerCase()).includes(task)) || null;
            if (runningGame) {
                break;
            }
        }

        if (runningGame !== this.runningGame) {
            this.runningGame = runningGame;
            this.handleGameChange();
        }
        setTimeout(this.watchForGameChanges, 2500);
    }

    handleGameChange = () => {
        if (this.currentClient) {
            this.currentClient.stopClient();
            this.currentClient = null;
        }
        
        this.tmBtLed.reset();

        if (!this.runningGame) {
            console.log("No game running");
            if (argv?.messagelights) {
                this.tmBtLed.setAllColors(true);
                this.tmBtLed.setRevLights(100);
            }
            if (argv?.message) {
                this.tmBtLed.setPerformanceMode();
                this.tmBtLed.showTicker(argv?.message);
            } else {
                this.tmBtLed.showTemporary("NO  GAME");
                this.tmBtLed.setPowerSaveMode();
            }
        } else {
            console.log("Detected game:", this.runningGame.name.toUpperCase());

            this.tmBtLed.showTemporary(this.runningGame.title[0], this.runningGame.title[1]);
            this.tmBtLed.setPerformanceMode();
    
            const Client = require("../clients/" + this.runningGame.name + ".js");
            this.currentClient = new Client(this.tmBtLed);
            this.currentClient.startClient();
        }
    }
}

class Test {
    revReversed = false;
    revPercent = 0;
    tmbtled;

    constructor () {
        this.start = this.start.bind(this);
        this.tmbtled = new TmBTLed(this.start);
    }

    start() {
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

let main = null;
if (argv?.test) {
    main = new Test();
} else if (argv?.setup) {
    main = new Setup();
} else {
    main = new Launcher();
}
