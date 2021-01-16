/*
 * Scan for TM BT Led and write necessary dump file
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import noble from 'noble';
import fs from "fs";

class TmBTLedDiscover {
 
      constructor() {
          this.initNoble();
      }

      initNoble = () => {
        let _this = this;
        noble.stopScanning();

        noble.on('stateChange', function (state) {
          if (state === 'poweredOn') {
            console.log("1. Starting scan...");
            noble.startScanning();
          } else {

            noble.stopScanning();
            // process.exit(0);
          }
        });

        let discovered = false;
        noble.on('discover', function (peripheral) {
          if (!discovered) {
            console.log("2. Discovering devices. Please press both pair buttons now...");
            discovered = true;
          }

          if (peripheral.uuid.match(/^0008.*/)) {
            noble.stopScanning();
            console.log("Found device ", peripheral.uuid, ". Writing dump..." );
            _this.writeDump(peripheral.uuid);
          }
        });
      }

      writeDump = (uuid) => {
        fs.readFile('./0008d3aabbcc.dump', 'utf8' , (err, data) => {
          if (err) {
            console.error("Template file not found. Please create dump manually.", err);
            process.exit();
            return;
          }
          
          data = data.replace("0008d3aabbcc", uuid).
            replace("00:08:d3:aa:bb:cc", "00:08:d3:aa:bb:cc".split(":").map((c,i) => (uuid[(i*2)] + uuid[(i*2)+1])).join(":"));
          
          fs.writeFile("./"+ uuid +".dump", data, err => {
            if (err) {
              console.error("Could't write dump. Please create dump manually.", err);
              process.exit();
              return
            }
            console.log("Dump written sucessfully. Run test.bat for a demo or a game script.");
            process.exit();
          })            
        })
      } 
}

const tmBtLedDiscover = new TmBTLedDiscover();


