/*
 * Game client for Dirt series
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { UdpListener } from './udpListener.js';
import AbstractClient from './abstractClient.mjs';
import fs from "fs";

import yargs from "yargs";
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv;

class DumpUdp extends AbstractClient {
   
    port = argv?.port || 20777;       // UDP port the client should listen on for telemetry data 
    writtenLines = 0;

    // Telemetry structure according to documentation
   
    constructor(...params) {
        super(...params);    

        this.initTmBtLed({
            onConnect: this.onDeviceConnected,
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode,
        });
    }

    onDeviceConnected = () =>  {
        this.client = new UdpListener({ port: this.port, bigintEnabled: true });
        console.log("5. Listening for game data... GO!");
        this.client.on("data", this.dumpData);
        this.client.start();

        fs.writeFile('udp_data.txt', 'Dump created on ' + new Date().toISOString() + "\r\n", function (err) {
          if (err) return console.log(err);
        });
        this.tmBtLed.updateDisplay("DMPS");
        this.tmBtLed.updateDisplay("0", true);
    }

    /**
     * Receives udp data from listener and writes to a file
     * @param buffer 
     */
    dumpData = (buffer) => {
        let _this = this;
        buffer = buffer.toString('hex').split("").map((c,i) => i % 2 == 0 ? c : c + " ").join("");
        fs.appendFile('udp_data.txt', buffer, function (err) {
            if (err) {
              throw err;
            }
            _this.tmBtLed.updateDisplay("" + _this.writtenLines++, true);
            console.log(buffer);
        });
    }
}

const dumpUdp = new DumpUdp("DUMPDATA", [], []);