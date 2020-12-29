/* eslint-disable handle-callback-err */
/** reconnect to a device that has been discovered earlier on using cache-gatt-discovery:
 * If a device is discovered and a dump file exists, load it and connect to it, re-initializing service
 * and characteristic objects in the noble stack.
 * Finds a temperature characteristic and registers for data.
 * Prints timing information from discovered to connected to reading states.
 */

const noble = require('noble-winrt');
const fs = require('fs');
const {performance} = require('perf_hooks');
const { F1TelemetryClient, constants } = require('f1-telemetry-client');
const { PACKETS } = constants;


const { debounce, throttle, isEqual } = require('lodash');




const client = new F1TelemetryClient({ port: 20777, bigintEnabled: true });

let buffer = new Buffer.alloc(20);
const initBuffer = (init) => {
    buffer.writeUInt8(0x04, 0); // x04
    for(i = 1; i < buffer.length; i++) {
        buffer.writeUInt8(0x00, i);
    }
    buffer.writeUInt8(128, 4); // 128! init led
}


initBuffer();



const setSpeed = (speed) => {
    if (speed > 255) {
        speed = 255;
    } else if (speed < 0) {
        speed = 0;
    }

    buffer.writeUInt8(speed, 3);
}

const setRpm = (rpm) => {
  if (rpm > 255) {
      rpm = 255;
  } else if (rpm < 0) {
      rpm = 0;
  }
  buffer.writeUInt8(rpm, 5);
}

const setRevLights = (percent) => {
    if (percent > 100) {
        return;
    }
    
    if (percent >= 50) {
        buffer.writeUInt8(255, 1)
        buffer.writeUInt8((1 << Math.floor((7/50) * (percent - 50))) - 1, 2);
    } else {
        buffer.writeUInt8((1 << Math.floor((8/50) * percent)) - 1, 1)
        buffer.writeUInt8(0, 2);
    }
}

const setGear = (gear) => {

    let gearCode = 0;
    switch(gear) {
      case -1:
        gearCode = 204;
        break;		
      case 0:
        gearCode = 192;
        break;
      case 1:
        gearCode = 249;
        break;
      case 2:
        gearCode = 164;
        break;
      case 3:
        gearCode = 176;
        break;
      case 4:
        gearCode = 153;
        break;
      case 5:
        gearCode = 146;
        break;
      case 6:
        gearCode = 131;
        break;
      case 7:
        gearCode = 248;
        break;
      case 8:
        gearCode = 128;
        break;
      case 9:
        gearCode = 152;
        break;
    }
    buffer.writeUInt8(gearCode, 11);
  }; 

const EXT = '.dump';


noble.stopScanning();

noble.on('stateChange', function (state) {
  if (state === 'poweredOn') {
    console.log("Start scan");
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});


noble.on('discover', function (peripheral) {
  console.log(`Discovered <${peripheral.address}, ${peripheral.addressType}>, RSSI ${peripheral.rssi}:`);

  // Check if a dump  exists in the current directory.
  fs.access(peripheral.uuid + EXT, fs.constants.F_OK, (err) => {
    if (!err) {
      console.log(`Found device config ${peripheral.uuid}`);

      quickConnect(peripheral);
    }
  });
});


// https://github.com/libusb/libusb/issues/334

// 22.1. Poll abstraction
const quickConnect = function (peripheral) {
  // BLE cannot scan and connect in parallel, so we stop scanning here:
  noble.stopScanning();
  peripheral.connect(async (error) => {
    if (error) {
      console.log(`Connect error: ${error}`);
      noble.startScanning([], true);
      return;
    }

    console.log('Connected');

     await new Promise(r => setTimeout(r, 1000));

    let t0 = performance.now();
    let t1 = performance.now();

 
    let counter = 0;

    peripheral.discoverSomeServicesAndCharacteristics(["1800"], [], (error, services, characteristics) => {
        console.log(services);
        console.log(characteristics);
    });

    setInterval(() => {
      setRevLights(Math.floor(Math.random() * 101));
    }, 20);

    setInterval(() => {
      setGear(Math.floor(Math.random() * 10) - 1);
    }, 50);
    


/*client.on(PACKETS.event, console.log);
client.on(PACKETS.motion, console.log);
client.on(PACKETS.carSetups, console.log);
client.on(PACKETS.lapData, console.log);
client.on(PACKETS.session, console.log);
client.on(PACKETS.participants, console.log);*/
  //client.on(PACKETS.carStatus, console.log);
  //client.on(PACKETS.finalClassification, console.log);
  //client.on(PACKETS.lobbyInfo, console.log);
  /*await new Promise(r => setTimeout(r, 5000));

 */
  client.on(PACKETS.carTelemetry, d => {
    setGear(d.m_carTelemetryData[0].m_gear);
    setRevLights(d.m_carTelemetryData[0].m_revLightsPercent);
    setSpeed(d.m_carTelemetryData[0].m_speed);
    setRpm(d.m_carTelemetryData[0].m_engineRPM);
  
  //  sendCommand();
  });

  
  // to start listening:
  client.start();


  /*peripheral.readHandle("51");

  peripheral.once("handleRead<51>", console.log);
  // peripheral.once("handleRead51", console.error);*/

  //peripheral.writeHandle("58", Buffer.from(buffer), true);
  
      // and when you want to stop:
      // client.stop();

  });
};
