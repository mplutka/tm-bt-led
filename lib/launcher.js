/*
 * Game client for F1 20xx
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const { getProcesses } = require("node-processlist");
const {TmBTLed, Setup} = require("./tmBTLed.js");

const yargs = require("yargs");
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const supportedGames = [
    { 
        name: "dump_udp", 
        bin: [], 
        title: ["DMPS","   0"]
    },
    {
        name: "_template",
        bin: [],
        title: ["TEMP", "LATE"]
    },
    {
        name: "assetto",
        bin: ["acc.exe", "assettocorsa.exe"],
        title: ["ASSETTO", "CORSA"]
    },
    {
        name: "f1",
        bin: ["f1_2019.exe", "f1_2019_dx12.exe", "f1_2020.exe", "f1_2020_dx12.exe", "f1_2021_dx12.exe"],
        title: [" F1 ", "20XX"]
    },
    {
        name: "dirt",
        bin: ["dirt3_game.exe", "drt4.exe", "drt.exe", "dirtrally2.exe"],
        title: ["DIRT", "RALLY"]
    },
    {
        name: "forza",
        bin: ["forzamotorsport7.exe", "forzahorizon4.exe", "forzahorizon5.exe"],
        title: [" FOR", "ZA  "]
    },
    {
        name: "projectcars2",
        bin: ["ams2avx.exe", "ams2.exe", "pcars3.exe", "pcars3avx.exe", "pcars2.exe", "pcars2avx.exe"],
        title: ["PROJECT", "CARS 2"]
    },
    {
        name: "iracing",
        bin: ["iRacingUI.exe", "iRacingSim64DX11.exe"],
        title: ["IRAC", "ING"]
    },
    {
        name: "rF2",
        bin: ["rFactor2.exe"],
        title: ["RFAC", "TOR2"]
    },
    {
        name: "raceroom",
        bin: ["RRRE.exe", "RRRE64.exe"],
        title: ["RACE", "ROOM"]
    },
    {
        name: "ets2",
        bin: ["eurotrucks2.exe"],
        title: ["EURO", "TS 2"]
    }
];

const excludedTasks = ["svchost.exe", "explorer.exe", "chrome.exe", "runtimebroker.exe", "conhost.exe", "csrss.exe", "cmd.exe", "wininit.exe", "winlogon.exe", "dllhost.exe", "services.exe"];

process.on('uncaughtException', function (exception) {
    console.error(exception);
});

class Launcher {
    runningGame = null; 
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
            this.tmBtLed.showTemporary("NO  GAME");
            this.tmBtLed.setPowerSaveMode();
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
            this.tmbtled.setRevLights(this.revPercent);
        
            this.tmbtled.setAllFlashing(true);
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
