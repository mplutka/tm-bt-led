/*
 * Game client for Dirt series
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { UdpListener } from '../lib/udpListener.js';
import AbstractClient from '../lib/abstractClient.mjs';
import fs from "fs";

import yargs from "yargs";
import { hideBin } from 'yargs/helpers'
const argv = yargs(hideBin(process.argv)).argv;

class DumpUdp extends AbstractClient {
   
    port = argv?.port || 20777;       // UDP port the client should listen on for telemetry data 
    writtenLines = 0;

    // Telemetry structure according to documentation
    constructor(tmBtLed) {
        if (!tmBtLed) {
            throw "No TM BT Led lib found.";
        }

        super(tmBtLed);    
        
        this.setCallbacks({
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode
        });
        // this.setModes(leftModes, rightModes);

        this.client = new UdpListener({ port: this.port, bigintEnabled: true });
        this.client.on("data", this.dumpData);
    }

    startClient = () => {
        this.client.start();

        fs.writeFile('udp_data.txt', 'Dump created on ' + new Date().toISOString() + "\r\n", function (err) {
          if (err) return console.log(err);
        });
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
export default DumpUdp;