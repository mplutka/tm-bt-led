/*
 * Game client for F1 20xx
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { snapshot } from "process-list";
import TmBTLed from "./tmBTLed.mjs";
import yargs from "yargs";
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv;

const supportedGames = [
    { name: "dump_udp", bin: [], title: ["DMPS","   0"] },
    { name: "_template", bin: [], title: ["TEMP", "LATE"] },
    { name: "assetto", bin: ["acc.exe", "assettocorsa.exe"], title: ["ASSETTO", "CORSA"] },
    { name: "f1", bin: ["f1_2019.exe", "f1_2019_dx12.exe", "f1_2020.exe", "f1_2020_dx12.exe"], title: ["F1", "20XX"] },
    { name: "dirt", bin: ["dirt3_game.exe", "drt4.exe", "drt.exe", "dirtrally2.exe"], title: ["DIRT", "RALLY"]},
    { name: "projectcars2", bin: ["ams2avx.exe", "ams2.exe", "pcars3.exe", "pcars2.exe"], title: ["PROJECT", "CARS 2"]},
    { name: "iracing", bin: ["iRacingUI.exe", "iRacingSim64DX11.exe"], title: ["iRAC", "ING"] }
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
        const tasks = await snapshot("name", "pmem");
        tasks.sort((a,b) => a.pmem === b.pmem ? 0 : (a.pmem < b.pmem) ? -1 : 1);
        const taskNames = tasks.map(t => t.name.toLowerCase()).filter(n => !excludedTasks.includes(n));
        let runningGame = null;
        for (let i = 0; i < taskNames.length; i++) {
            const task = taskNames[i];
            runningGame = supportedGames.find(game => {
                return game.bin.map(t => t.toLowerCase()).includes(task);
            }) || null;
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
    
            import("../clients/" + this.runningGame.name + ".mjs").then(Client => {
                this.currentClient = new Client.default(this.tmBtLed);
                this.currentClient.startClient();
            });
        }
    }
}

const launcher = new Launcher();