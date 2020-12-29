/* eslint-disable handle-callback-err */
/** reconnect to a device that has been discovered earlier on using cache-gatt-discovery:
 * If a device is discovered and a dump file exists, load it and connect to it, re-initializing service
 * and characteristic objects in the noble stack.
 * Finds a temperature characteristic and registers for data.
 * Prints timing information from discovered to connected to reading states.
 */

const noble = require('../index');
const fs = require('fs');
const {performance} = require('perf_hooks');
const { F1TelemetryClient, constants } = require('f1-telemetry-client');
const { PACKETS } = constants;
var BitArray = require('node-bitarray');

var readline = require('readline-promise').default;
const rlp = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

let buffer = new Buffer.alloc(20);

const updateBuffer = () => {
   BitArray.toBuffer(bitArray).copy(buffer);
};

// special:
// Rev Left Blue
// L1  MUST SET!
// L2  Left TimeSpacer
// L3  Left Red
// L4  Left Yellow

// R1  Right Yellow
// R2  Right Red
// R3  Right TimeSpacer
// R4  Right Blue

const bitRanges = {
  "revLights1":       [8, 15],
  "revLights2":       [17, 23],
  "leftBlue":         [16, 16],
  "leftTimeSpacer":   [48, 48],
  "leftRed":          [64, 64],
  "leftYellow":       [80, 80],  
  "leftChar1":        [24, 31],
  "leftChar2":        [40, 55],
  "leftChar3":        [56, 63],
  "leftChar4":        [72, 87],
  "gear":             [89, 94],
  "gearDot":          [88, 88],
  "rightBlue":        [152, 152],  
  "rightYellow":      [104, 104],
  "rightRed":         [136, 136],
  "rightTimeSpacer":  [120, 120],
  "rightChar1":       [96, 111],
  "rightChar2":       [112, 127],
  "rightChar3":       [128, 143],
  "rightChar4":       [144, 151]
};

const bitArray = [ 
  0, 0, 0, 0, 0, 1, 0, 0, // 0   // 0, Mode: Muss 4 sein
  0, 0, 0, 0, 0, 0, 0, 0, // 8   // 1, RevLights 1.
  0, 0, 0, 0, 0, 0, 0, 0, // 16  // 2, RevLights 2. + Blue left
  0, 0, 0, 0, 0, 0, 0, 0, // 24  // 3, L1
  1, 0, 0, 0, 0, 0, 0, 0, // 32  // 4, Special Bit (muss 1 sein!), L1
  0, 0, 0, 0, 0, 0, 0, 0, // 40  // 5, L2
  0, 0, 0, 0, 0, 0, 0, 0, // 48  // 6, Special Bit, L2
  0, 0, 0, 0, 0, 0, 0, 0, // 56  // 7, L3
  0, 0, 0, 0, 0, 0, 0, 0, // 64  // 8, Special Bit, L3
  0, 0, 0, 0, 0, 0, 0, 0, // 72  // 9, L4
  0, 0, 0, 0, 0, 0, 0, 0, // 80  // 10,Special Bit, L4 
  1, 1, 1, 1, 1, 1, 1, 1, // 88  // 11, Gear
  0, 0, 0, 0, 0, 0, 0, 0, // 96  // 12, R1
  0, 0, 0, 0, 0, 0, 0, 0, // 104 // 13, Special Bit, R1
  0, 0, 0, 0, 0, 0, 0, 0, // 112 // 14, R2
  0, 0, 0, 0, 0, 0, 0, 0, // 120 // 15, Special Bit, R2
  0, 0, 0, 0, 0, 0, 0, 0, // 128 // 16, R3
  0, 0, 0, 0, 0, 0, 0, 0, // 136 // 17, Special Bit, R3
  0, 0, 0, 0, 0, 0, 0, 0, // 144 // 18, R4
  0, 0, 0, 0, 0, 0, 0, 0  // 152 // 19, Special Bit, R4
];

// m1 m1 lo lu u ru ro o special dot slashlu slashu slashru slashro slashm  slashlo
// 1  2  3  4  5 6  7  8 1       2       3       4      5       6       7       8
const charMap = {
  " ": "00000000 0000000",
  "0": "00111111 0100100",
  "1": "00000110 0000000",
  "2": "11011011 0000000",
  "3": "10001111 0000000",
  "4": "11100110 0000000",
  "5": "11101101 0000000",
  "6": "11111101 0000000",
  "7": "00000111 0000000",
  "8": "11111111 0000000",
  "9": "11100111 0000000",

  "A": "11110111 0000000",
  //"B": "00000000 0000000", 
  //"C": "00000000 0000000", 
  //"D": "00000000 0000000", 
  "E": "01111001 0000000",
  "F": "01110001 0000000",
  "L": "00111000 0000000",
  "P": "11110011 0000000",
  "K": "00000000 0011110",
  "k": "00000000 0011110",
  "H": "11110110 0000000",
  "M": "00110110 0000101",
  "-": "11000000 0000000",
};

updateBuffer();


const getNum = () => {
  rlp.questionAsync('Num?').then(num => {
    if (num.length === 1) {

      if (num === "y") {
        toggleLeftBlue(true);
        toggleRightBlue(true);
        getNum();
        return;
      }
      if (num === "x") {
        toggleLeftRed(true);
        toggleRightRed(true);
        getNum();
        return;
      }      
      if (num === "c") {
        toggleLeftYellow(true);
        toggleRightYellow(true);
        getNum();
        return;
      }            
      if (num === "v") {
        toggleLeftTimeSpacer(true);
        toggleRightTimeSpacer(true);
        getNum();
        return;
      }        
      
      if (num === "b") {
        toggleGearDot(true);
        getNum();
        return;
      }          

      setLeftChar1(num);
      setLeftChar2(num);
      setLeftChar3(num);
      setLeftChar4(num);
      setRightChar1(num);
      setRightChar2(num);
      setRightChar3(num);
      setRightChar4(num);

      setRevLights(num * 10);

      getNum();
      return;
    }


    if (num > 255 || num.length > 3) {
      num = BitArray.toNumber(BitArray.fromBinary(num).toJSON());
    }
    
    getNum();
  });
};

getNum();

const flipBit = (bit) => {
  bitArray[bit] = bitArray[bit] === 1 ? 0 : 1;
  updateBuffer();
}

const setBit = (bit, on, inverted) => {
  bitArray[bit] = on ? (inverted ? 0 : 1) : (inverted ? 1 : 0);
  updateBuffer();
}


const setLedSegments = (type, bitString, withDot) => {
  const bits = (bitString || "").split("");
  const bitStart = bitRanges[type][0];
  for(i = 0; i < bits.length; i++) {
    // TODO: Daten nicht als String erhalten
    if (bits[i] === " ") {
      // Skip this bit
      continue;
    }
    bitArray[bitStart + i] = parseInt(bits[i]);
  }
  bitArray[bitStart + 9] = withDot ? 1 : 0;
  
  updateBuffer();
};

const setLeftChar1 = char => {
  setLedSegments("leftChar1", charMap[char]);
};

const setLeftChar2 = char => {
  setLedSegments("leftChar2", charMap[char]);
};

const setLeftChar3 = char => {
  setLedSegments("leftChar3", charMap[char]);
};

const setLeftChar4 = char => {
  setLedSegments("leftChar4", charMap[char]);
};

const setRightChar1 = char => {
  setLedSegments("rightChar1", charMap[char]);
};

const setRightChar2 = char => {
  setLedSegments("rightChar2", charMap[char]);
};

const setRightChar3 = char => {
  setLedSegments("rightChar3", charMap[char]);
};

const setRightChar4 = char => {
  setLedSegments("rightChar4", charMap[char]);
};

const setGear = gear => {
  let gearCode = "1111111";
  switch(gear) {
    case -1:
      gearCode = "1001100";
      break;		
    case 0:
      gearCode = "1000000";
      break;
    case 1:
      gearCode = "1111001";
      break;
    case 2:
      gearCode = "0100100";
      break;
    case 3:
      gearCode = "0110000";
      break;
    case 4:
      gearCode = "0011001";
      break;
    case 5:
      gearCode = "0010010";
      break;
    case 6:
      gearCode = "0000011";
      break;
    case 7:
      gearCode = "1111000";
      break;
    case 8:
      gearCode = "0000000";
      break;
    case 9:
      gearCode = "0011000";
      break;
    case null:
    case undefined:
    case false:
    default:
      gearCode: "1111111";
      break;      
  }
  setLedSegments("gear", gearCode);
};


const setGearDot = (on) => {
  setBit(bitRanges["gearDot"][0], on, inverted);
};
const toggleGearDot = () => {
  flipBit(bitRanges["gearDot"][0]);
};


const setLeftTimeSpacer = (on) => {
  setBit(bitRanges["leftTimeSpacer"][0], on);
}
const toggleLeftTimeSpacer = () => {
  flipBit(bitRanges["leftTimeSpacer"][0]);
};

const setRightTimeSpacer = (on) => {
  setBit(bitRanges["rightTimeSpacer"][0], on);
}
const toggleRightTimeSpacer = () => {
  flipBit(bitRanges["rightTimeSpacer"][0]);
};

const setLeftBlue = (on) => {
  setBit(bitRanges["leftBlue"][0], on);
}
const toggleLeftBlue = () => {
  flipBit(bitRanges["leftBlue"][0]);
};
const setRightBlue = (on) => {
  setBit(bitRanges["rightBlue"][0], on);
}
const toggleRightBlue = () => {
  flipBit(bitRanges["rightBlue"][0]);
};
const setBlue = (on) => {
  setBit(bitRanges["leftBlue"][0], on)
  setBit(bitRanges["rightBlue"][0], on)
};
const toggleBlue = () => {
  flipBit(bitRanges["leftBlue"][0]);
  flipBit(bitRanges["rightBlue"][0]);
};

const setLeftRed = (on) => {
  setBit(bitRanges["leftRed"][0], on);
}
const toggleLeftRed = () => {
  flipBit(bitRanges["leftRed"][0]);
};
const setRightRed = (on) => {
  setBit(bitRanges["rightRed"][0], on);
}
const toggleRightRed = () => {
  flipBit(bitRanges["rightRed"][0]);
};
const setRed = (on) => {
  setBit(bitRanges["leftRed"][0], on)
  setBit(bitRanges["rightRed"][0], on)
};
const toggleRed = () => {
  flipBit(bitRanges["leftRed"][0]);
  flipBit(bitRanges["rightRed"][0]);
};

const setLeftYellow = (on) => {
  setBit(bitRanges["leftYellow"][0], on);
}
const toggleLeftYellow = () => {
  flipBit(bitRanges["leftYellow"][0]);
};
const setRightYellow = (on) => {
  setBit(bitRanges["rightYellow"][0], on);
}
const toggleRightYellow = () => {
  flipBit(bitRanges["rightYellow"][0]);
};
const setYellow = (on) => {
  setBit(bitRanges["leftYellow"][0], on)
  setBit(bitRanges["rightYellow"][0], on)
};
const toggleYellow = () => {
  flipBit(bitRanges["leftYellow"][0]);
  flipBit(bitRanges["rightYellow"][0]);
};
let flashingYellowInterval = null;
let isFlashingYellow = false;
const setFlashingYellow = (shouldFlash) => {
  if (!shouldFlash) {
    setYellow(false);
    if(flashingYellowInterval !== null) {
      clearInterval(flashingYellowInterval);
      flashingYellowInterval = null;
      isFlashingYellow = false;
    }
    return;
  }
  if (shouldFlash == isFlashingYellow) {
    return;
  }

  isFlashingYellow = shouldFlash;
  if (flashingYellowInterval !== null) {
    clearInterval(flashingYellowInterval);
    flashingYellowInterval = null;
  }
  flashingYellowInterval = setInterval(() => {
    toggleYellow();
  }, 500);
}

let flashingBlueInterval = null;
let isFlashingBlue = false;
const setFlashingBlue = (shouldFlash) => {
  if (!shouldFlash) {
    setBlue(false);
    if(flashingBlueInterval !== null) {
      clearInterval(flashingBlueInterval);
      flashingBlueInterval = null;
      isFlashingBlue = false;
    }
    return;
  }
  if (shouldFlash == isFlashingBlue) {
    return;
  }

  isFlashingBlue = shouldFlash;
  if (flashingBlueInterval !== null) {
    clearInterval(flashingBlueInterval);
    flashingBlueInterval = null;
  }
  flashingBlueInterval = setInterval(() => {
    toggleBlue();
  }, 500);
}

let flashingRedInterval = null;
let isFlashingREd = false;
const setFlashingRed = (shouldFlash) => {
  if (!shouldFlash) {
    setRed(false);
    if(flashingRedInterval !== null) {
      clearInterval(flashingRedInterval);
      flashingRedInterval = null;
      isFlashingREd = false;
    }
    return;
  }
  if (shouldFlash == isFlashingREd) {
    return;
  }

  isFlashingREd = shouldFlash;
  if (flashingRedInterval !== null) {
    clearInterval(flashingRedInterval);
    flashingRedInterval = null;
  }
  flashingRedInterval = setInterval(() => {
    toggleRed();
  }, 500);
}

const setAllFlashing = (shouldFlash) => {
  setFlashingBlue(shouldFlash);
  setFlashingYellow(shouldFlash);
  setFlashingRed(shouldFlash);
}

const setAllColors = (on) => {
  setBlue(on);
  setRed(on);
  setYellow(on);
} 

const toggleAllColors = () => {
  toggleBlue();
  toggleRed();
  toggleYellow();
} 


const client = new F1TelemetryClient({ port: 20777, bigintEnabled: true });

const setSpeed = (speed, right) => {
  if (speed < 0) {
    speed = 0;
  }
  speed = speed.toFixed(1);
  setNumber(speed, right);
}

const setRpm = (rpm, right) => {
  if (rpm >= 10000) {
    rpm = (rpm / 1000).toFixed(1) + "K";
  } else {
    rpm = rpm.toFixed(0);
  }
  setNumber(rpm, right);
}

const setNumber = (numberString, right) => {
  let chars = (numberString || "").split("");
  let slots = [];
  for (let i = 0; i < chars.length; i++) {
    if(i < chars.length - 1 && (chars[i + 1] === "." || chars[i + 1] === ",")) {
      slots.push(chars[i] + ".");
      i++;
    } else {
      slots.push(chars[i]);
    }
  }
  while(slots.length < 4) {
    slots.unshift(" ");
  }
  for(let i = 0; i < Math.min(4,slots.length); i++) {
    const splittedChar = (slots[i] || "").split("");
    const char = charMap[splittedChar[0]];
    const withDot = splittedChar.length === 2 && splittedChar[1] === ".";
    setLedSegments((right ? "right" : "left") + "Char" + (i + 1), char, withDot );
  }
};

let revLightsFlashingIntervalId = null;
let revLightsFlashing = 0;
const setRevLightsFlashing = (flashStatus) => {
  if (flashStatus === 0 && revLightsFlashing !== 0) {
    revLightsFlashing = 0;
    setRevLights(0);
    if(revLightsFlashingIntervalId !== null) {
      clearInterval(revLightsFlashingIntervalId);
      revLightsFlashingIntervalId = null;
    }
    return;
  }
  if (flashStatus == revLightsFlashing) {
    return;
  }

  revLightsFlashing = flashStatus;
  if (revLightsFlashingIntervalId !== null) {
    clearInterval(revLightsFlashingIntervalId);
    revLightsFlashingIntervalId = null;
  }
  revLightsFlashingIntervalId = setInterval(() => {
    toggleRevLights();
  }, revLightsFlashing === 1 ? 500 : 250);
};
const setRevLights = (percent) => {
    if (percent > 100) {
        return;
    }
    
    let firstByte = (1 << Math.floor((8/50) * percent)) - 1;
    let secondByte = 0;
    if (percent >= 50) {
        firstByte = 255;
        secondByte = (1 << Math.floor((7/50) * (percent - 50))) - 1;
    }
    const firstBitStart = bitRanges["revLights1"][0];
    const firstBitArray = BitArray.fromNumber(firstByte).toJSON();
    while (firstBitArray.length < 8) {
      firstBitArray.unshift(0);
    }
    const secondBitStart = bitRanges["revLights2"][0];
    const secondBitArray = BitArray.fromNumber(secondByte).toJSON();
    while (secondBitArray.length < 7) {
      secondBitArray.unshift(0);
    }
    for (let i = 0; i < firstBitArray.length; i++) {
      bitArray[firstBitStart + i] = parseInt(firstBitArray[i]);
      if (i < secondBitArray.length) {
        bitArray[secondBitStart + i] = parseInt(secondBitArray[i]);
      }
    }

    updateBuffer();
}
let revLightsOn = false;
const toggleRevLights = () => {
  revLightsOn = !revLightsOn;
  setRevLights(revLightsOn ? 100 : 0);
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

var perfectTimer = {                                                              // Set of functions designed to create nearly perfect timers that do not drift
  timers: {},                                                                     // An object of timers by ID
nextID: 0,                                                                      // Next available timer reference ID
set: (callback, interval) => {                                                  // Set a timer
  var expected = Date.now() + interval;                                         // Expected currect time when timeout fires
  var ID = perfectTimer.nextID++;                                               // Create reference to timer
  function step() {                                                             // Adjusts the timeout to account for any drift since last timeout
    callback();                                                                 // Call the callback
    var dt = Date.now() - expected;                                             // The drift (ms) (positive for overshooting) comparing the expected time to the current time
    expected += interval;                                                       // Set the next expected currect time when timeout fires
    perfectTimer.timers[ID] = setTimeout(step, Math.max(0, interval - dt));     // Take into account drift
  }
  perfectTimer.timers[ID] = setTimeout(step, interval);                         // Return reference to timer
  return ID;
},
clear: (ID) => {                                                                // Clear & delete a timer by ID reference
  if (perfectTimer.timers[ID] != undefined) {                                   // Preventing errors when trying to clear a timer that no longer exists
    console.log('clear timer:', ID);
    console.log('timers before:', perfectTimer.timers);
    clearTimeout(perfectTimer.timers[ID]);                                      // Clear timer
    delete perfectTimer.timers[ID];                                             // Delete timer reference
    console.log('timers after:', perfectTimer.timers);
  }
  }       
}



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

      setLeftChar1(" ");
      setLeftChar2(" ");
      setLeftChar3("F");
      setLeftChar4("1");

      setRightChar1("2");
      setRightChar2("0");
      setRightChar3("1");
      setRightChar4("9");

      console.log("discovered");


        var updateLoop = perfectTimer.set(() => {
          peripheral.writeHandle("58", buffer, true);
        }, 40);

        /*setInterval(() => {
          peripheral.writeHandle("58", buffer, true);
        }, 40); // 40! */

        const test = () => {
          setInterval(() => {
            setRevLights(Math.floor(Math.random() * 101));
          }, 10);

          setInterval(() => {
            setGear(Math.floor(Math.random() * 10) - 1);
          }, 10);
        };

        // test();
        
        /*peripheral.discoverServices(["1812"], () => {
      //peripheral.updatePrio(1);
 
        }) */
    

// https://f1-2019-telemetry.readthedocs.io/en/latest/telemetry-specification.html
/*client.on(PACKETS.event, console.log);
client.on(PACKETS.motion, console.log);
client.on(PACKETS.carSetups, console.log);
client.on(PACKETS.lapData, console.log);
client.on(PACKETS.session, console.log);
client.on(PACKETS.participants, console.log);*/
client.on(PACKETS.carStatus, d => {
    const myIndex = d.m_header.m_playerCarIndex;
    switch(d.m_carStatusData[myIndex].m_vehicleFiaFlags) {
      case 2:
        setFlashingBlue(true);
        break      
      case 3:
        setFlashingYellow(true);
        break         
      case 4:
        setFlashingRed(true);
        break                      
      case -1:
      case 0:
      default:
        setAllFlashing(false);
        break
    }


    if (d.m_carStatusData[myIndex].m_pitLimiterStatus === 1) {
      setRevLightsFlashing(1);
    } else {
      setRevLightsFlashing(0);
    }
});
  //client.on(PACKETS.finalClassification, console.log);
  //client.on(PACKETS.lobbyInfo, console.log);
  /*await new Promise(r => setTimeout(r, 5000));

 */
let revLimitIntervalId = null;
client.on(PACKETS.carTelemetry, d => {
    const myIndex = d.m_header.m_playerCarIndex;
    setGear(d.m_carTelemetryData[myIndex].m_gear);

    if (revLightsFlashing !== 1) { // No override because of pit or rev limiter

      /*if (revLimitIntervalId === null && d.m_carTelemetryData[myIndex].m_revLightsPercent === 100) {
        // revLimitIntervalId = setInterval(() => setRevLights(0), 20);
        revLimitIntervalId = perfectTimer.set(() => {
          setRevLights(0);
        }, 20);

      } else if (d.m_carTelemetryData[myIndex].m_revLightsPercent < 90 && revLimitIntervalId !== null) {
          // clearInterval(revLimitIntervalId);
          perfectTimer.clear(revLimitIntervalId);
          revLimitIntervalId = null;
      } */
      setRevLights(d.m_carTelemetryData[myIndex].m_revLightsPercent);
    }

    setSpeed(d.m_carTelemetryData[myIndex].m_speed, false);

    setRpm(d.m_carTelemetryData[myIndex].m_engineRPM, true);
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
