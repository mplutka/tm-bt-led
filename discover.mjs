import noble from 'noble';
import fs from "fs";
import BitArray from "node-bitarray";
import readline from 'readline-promise';

class TmBTLedDiscover {
 
      constructor() {
          this.initNoble();
      }


      initNoble = () => {
        let myself = this;
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
            console.log("2. Discovering devices...");
            discovered = true;
          }

          console.log("  - Discovered device:", peripheral.uuid, peripheral.uuid.match(/^0008.*/) ? "<< This could be it!" : "");
        });
    }

    loadData = (peripheral) => {
      const dump = fs.readFileSync(peripheral.uuid + TmBTLed.EXT);
      const data = JSON.parse(dump);
    
      // verify data: console.log(JSON.stringify(data,null,2))
      return data;
    };
    
    setData = (peripheral, meta) => {
      // first, create the service objects:
      //console.log('initializing services... ');
    
      // addServices returns an array of initialized service objects
      const services = noble.addServices(peripheral.uuid, meta.services);
    
      console.log('3. Initializing services...');   
      let foundCharacteristics = [null, null, null, null];
    
      for (const i in services) {
        const service = services[i];
        if (service.uuid !== "1812") {
          continue;
        }
        const charas = meta.characteristics[service.uuid];   
        const characteristics = noble.addCharacteristics(peripheral.uuid, service.uuid, charas);
        let characteristicCount = 0;
        for (const j in characteristics) {
          const characteristic = characteristics[j];
          if (characteristic.uuid !== "2a4d") {
            continue;
          }
          foundCharacteristics[characteristicCount++] = characteristic;
        }
      }
      return foundCharacteristics;
    };
}

const tmBtLedDiscover = new TmBTLedDiscover();


