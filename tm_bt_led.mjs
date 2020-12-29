import noble from 'noble';
import fs from "fs";
import BitArray from "node-bitarray";
import readline from 'readline-promise';

const perfectTimer = {                                                              // Set of functions designed to create nearly perfect timers that do not drift
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
    clearTimeout(perfectTimer.timers[ID]);                                      // Clear timer
    delete perfectTimer.timers[ID];                                             // Delete timer reference
  }
  }       
}


const rlp = readline.default.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

class TmBTLed {
  updateInterval = 60;

  getNum = () => {
    rlp.questionAsync('Num?').then(num => {
      if (num.length === 1) {
  
        if (num === "y") {
          this.callbacks.onLeftPreviousMode();    
          return;
        }
        if (num === "x") {
          this.callbacks.onLeftNextMode();   
          return;
        }      
        if (num === "c") {
          this.callbacks.onRightPreviousMode();    
          return;
        }            
        if (num === "v") {
          this.callbacks.onRightNextMode();   
          return;
        }        
        
        if (num === "b") {
          this.toggleGearDot(true);
          this.getNum();
          return;
        }        
  
        this.setLeftChar1(num);
        this.setLeftChar2(num);
        this.setLeftChar3(num);
        this.setLeftChar4(num);
        this.setRightChar1(num);
        this.setRightChar2(num);
        this.setRightChar3(num);
        this.setRightChar4(num);
  
        this.setRevLights(num * 10);
  
        this.getNum();
        return;
      }
  
  
      if (num > 255 || num.length > 3) {
        num = BitArray.toNumber(BitArray.fromBinary(num).toJSON());
      }
      
      this.getNum();
    });
  };
  
      constructor(callbacks) {
          this.buffer = new Buffer.alloc(20);
          this.updateBuffer();
          this.initNoble();
          this.callbacks = callbacks;

          // this.getNum();
      }

      static EXT = '.dump';
      
      static BitRanges = {
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

    // mh mv lo lu u ru ro o   special dot slashlu slashu slashru slashro slasho  slashlo
    // 1  2  3  4  5 6  7  8   1       2       3       4      5       6       7       8
    // https://www.geocachingtoolbox.com/index.php?lang=en&page=segmentDisplay
    static CharMap = {
        " ": "00000000 0000000",
        "0": "00111111 0100100",
        "1": "00000110 0000100",
        "2": "11011011 0000000",
        "3": "10001111 0000000",
        "4": "11100110 0000000",
        "5": "11101101 0000000",
        "6": "11111101 0000000",
        "7": "00000001 0010100",
        "8": "11111111 0000000",
        "9": "11100111 0000000",
        "A": "11110111 0000000",
        "B": "10001111 0010010", 
        "C": "00111001 0000000", 
        "D": "00001111 0010010", 
        "E": "01111001 0000000",
        "F": "01110001 0000000",
        "G": "10111101 0000000",
        "H": "11110110 0000000",
        "I": "00001001 0010010",
        "J": "00011110 0000000",
        "K": "01110000 0001100",
        "k": "00000000 0011110",
        "L": "00111000 0000000",
        "M": "00110110 0000101",
        "N": "00110110 0001001",
        "O": "00111111 0000000",
        "P": "11110011 0000000",
        "Q": "00111111 0001000",
        "R": "11110011 0001000",        
        "S": "10001101 0000001",
        "T": "00000001 0010010",
        "U": "00111110 0000000",
        "V": "00110000 0100100",
        "W": "00110110 0101000",        
        "X": "00000000 0101101",        
        "Y": "00000000 0010101",
        "Z": "00001001 0100100",        
        "-": "11000000 0000000"
    };

    indicationOnLeftDisplay = null; // Timer
    indicationOnRightDisplay = null;  // Timer
    flashingYellowInterval = null;
    isFlashingYellow = false;
    flashingBlueInterval = null;
    isFlashingBlue = false;
    flashingRedInterval = null;
    isFlashingRed = false;
    revLimitIntervalId = null;
    revLightsFlashingIntervalId = null;
    revLightsFlashing = 0;
    revLightsOn = false;
    currentLeftButton = null;
    currentRightButton = null;

    // https://github.com/libusb/libusb/issues/334
    // 22.1. Poll abstraction
    quickConnect = (peripheral) => {
      let myself = this;
      // BLE cannot scan and connect in parallel, so we stop scanning here:
      noble.stopScanning();
      peripheral.connect(async (error) => {
        if (error) {
          console.log(`Connect error: ${error}`);
          noble.startScanning([], true);
          return;
        }



          noble.on('connectionParameterUpdateRequest', (minInterval, maxInterval) => {
            console.log("Update interval changed", minInterval);
            this.updateInterval = minInterval;
          });

          const meta = this.loadData(peripheral);
          const [report1, report2, report3, report4 ] = this.setData(peripheral, meta);

          if (!report1) { // Report 1
            console.log('Warning - no event characteristic found.');
          } else {
            console.log("Initialized event channel");
            report1.subscribe();
            report1.on("data", this.handleEvent);
            report1.discoverDescriptors();
          }
          
          if (!report3) { // Report 3
            console.log('Warning - no update characteristic found.');
          } else {
            console.log("Initialized update channel");
            report3.discoverDescriptors();
          }

          if (report4) { // Report 4
            report4.unsubscribe();
            report4.discoverDescriptors((err, ds) => {
              // await new Promise(resolve => setTimeout(resolve, 5000));

                console.log('Connected at interval', this.updateInterval);
                let currentBuffer = new Buffer.alloc(20);
                myself.updateLoop = perfectTimer.set(() => {
                  if (Buffer.compare(currentBuffer, myself.buffer) !== 0) {
                      if (report3) {
                        report3.write(myself.buffer, true);
                      } else {
                        peripheral.writeHandle("58", myself.buffer, true);                  
                      }
                      myself.buffer.copy(currentBuffer);
                  }

                }, this.updateInterval);

                if (myself.callbacks.onConnect) {
                  myself.callbacks.onConnect();
                }


                const test = () => {
                  setInterval(() => {
                    this.setRpm(Math.floor(Math.random() * 101));
                  }, 10);
                };
                // test(); 

            });
          }

        });
    }

    handleEvent = (data) => {
        if (!this.callbacks.onLeftPreviousMode || !this.callbacks.onLeftNextMode || !this.callbacks.onRightNextMode || !this.callbacks.onRightPreviousMode) {
            return;
        }
        const leftButton = data[1];
        if (this.currentLeftButton === null) {
          this.currentLeftButton = leftButton;
        }
        if (leftButton !== this.currentLeftButton) {
          if (this.currentLeftButton + 1 === leftButton || (this.currentLeftButton === 255 && leftButton === 0)) {
            this.callbacks.onLeftNextMode();         
          } else {
            this.callbacks.onLeftPreviousMode();
          }
          this.currentLeftButton = leftButton;
        }

        const rightButton = data[2];
        if (this.currentRightButton === null) {
          this.currentRightButton = rightButton;
        }
        if (rightButton !== this.currentRightButton) {
          if (this.currentRightButton + 1 === rightButton || (this.currentRightButton === 255 && rightButton === 0)) {
            this.callbacks.onRightNextMode();                 
          } else {
            this.callbacks.onRightPreviousMode();
          }
          this.currentRightButton = rightButton;
        }
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
    
      console.log('initialized services: ');
      for (const i in services) {
        const service = services[i];
        //console.log(`\tservice ${i} ${service}`);
      }
      //console.log();
    
      let foundCharacteristics = [null, null, null, null];
    
      console.log('Initializing characteristics... ');
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

    initNoble = () => {
        let myself = this;
        noble.stopScanning();

        noble.on('stateChange', function (state) {
          if (state === 'poweredOn') {
            console.log("Start scan");
            noble.startScanning();
          } else {

            noble.stopScanning();
            // process.exit(0);
          }
        });

        let discovered = false;
        noble.on('discover', function (peripheral) {
          
          if (!discovered) {
            console.log("Discovering devices...");
            discovered = true;
          }
          // Check if a dump  exists in the current directory.
          fs.access(peripheral.uuid + TmBTLed.EXT, fs.constants.F_OK, (err) => {
            if (!err) {
              console.log(`Found device config ${peripheral.uuid}`);

              myself.quickConnect(peripheral);
            }
          });
        });
    }
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
  bitArray = [ 
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
      0, 0, 0, 0, 0, 0, 0, 0, // 80  // 10, Special Bit, L4 
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

    updateBuffer = () => {
      BitArray.toBuffer(this.bitArray).copy(this.buffer);
    };  

flipBit = (bit) => {
  this.bitArray[bit] = this.bitArray[bit] === 1 ? 0 : 1;
  this.updateBuffer();
}

setBit = (bit, on, inverted) => {
  this.bitArray[bit] = on ? (inverted ? 0 : 1) : (inverted ? 1 : 0);
  this.updateBuffer();
}

setLedSegments = (type, bitString, withDot) => {
    const bits = (bitString || "").split("");
    const bitStart = TmBTLed.BitRanges[type][0];

    for(let i = 0; i < bits.length; i++) {
      // TODO: Daten nicht als String erhalten
      if (bits[i] === " ") {
        // Skip this bit
        continue;
      }
      this.bitArray[bitStart + i] = parseInt(bits[i]);
    }
    if (bitStart + 9 <= TmBTLed.BitRanges[type][1]) {
      this.bitArray[bitStart + 9] = withDot ? 1 : 0;
    }
    this.updateBuffer();
};

setLeftDisplay = str => {
  while(str.length < 4) {
    str = " " + str;
  }

  str.split("").slice(0,4).forEach((c, i) => {
    this.setLedSegments("leftChar" + (i + 1), TmBTLed.CharMap[c], false);
  });
}

flashLeftDisplay = str => {
  this.setLeftTimeSpacer(false);
  if (this.indicationOnLeftDisplay !== null) {
    clearTimeout(this.indicationOnLeftDisplay);
    this.indicationOnLeftDisplay = null;
  }
  this.setLeftDisplay(str);
  let myself = this;
  this.indicationOnLeftDisplay = setTimeout(() => {
    myself.indicationOnLeftDisplay = null;
  }, 2000);
}

updateLeftDisplay = (str, isNumber) => {
  if (this.indicationOnLeftDisplay !== null) {
    return;
  }
  if(str.match(/[\d]+/)) {
    this.setNumber(str, false);
  } else {
    this.setLeftDisplay(str);
  }
}

setRightDisplay = str => {
  while(str.length < 4) {
    str = " " + str;
  }

  str.split("").slice(0,4).forEach((c, i) => {
    this.setLedSegments("rightChar" + (i + 1), TmBTLed.CharMap[c], false);
  })
}

flashRightDisplay = str => {
  this.setRightTimeSpacer(false);
  if (this.indicationOnRightDisplay !== null) {
    clearTimeout(this.indicationOnRightDisplay);
    this.indicationOnRightDisplay = null;
  }
  this.setRightDisplay(str);
  let myself = this;
  this.indicationOnRightDisplay = setTimeout(() => {
    myself.indicationOnRightDisplay = null;
  }, 2000);
}

updateRightDisplay = (str) => {
  if (this.indicationOnRightDisplay !== null) {
    return;
  }

  if(!isNaN(str)) {
    this.setNumber(str, true);
  } else {
    this.setRightDisplay(str);
  }
}

setLeftChar1 = char => {
  this.setLedSegments("leftChar1", TmBTLed.CharMap[char]);
};

setLeftChar2 = char => {
  this.setLedSegments("leftChar2", TmBTLed.CharMap[char]);
};

setLeftChar3 = char => {
  this.setLedSegments("leftChar3", TmBTLed.CharMap[char]);
};

setLeftChar4 = char => {
  this.setLedSegments("leftChar4", TmBTLed.CharMap[char]);
};

setRightChar1 = char => {
  this.setLedSegments("rightChar1", TmBTLed.CharMap[char]);
};

setRightChar2 = char => {
  this.setLedSegments("rightChar2", TmBTLed.CharMap[char]);
};

setRightChar3 = char => {
  this.setLedSegments("rightChar3", TmBTLed.CharMap[char]);
};

setRightChar4 = char => {
  this.setLedSegments("rightChar4", TmBTLed.CharMap[char]);
};

    setGear = gear => {
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
        this.setLedSegments("gear", gearCode);
    };


  setGearDot = (on) => {
    this.setBit(TmBTLed.BitRanges["gearDot"][0], on, inverted);
  };
  toggleGearDot = () => {
    this.flipBit(TmBTLed.BitRanges["gearDot"][0]);
  };


    setLeftTimeSpacer = (on) => {
      this.setBit(TmBTLed.BitRanges["leftTimeSpacer"][0], on);
    }

    toggleLeftTimeSpacer = () => {
      this.flipBit(TmBTLed.BitRanges["leftTimeSpacer"][0]);
    };

    setRightTimeSpacer = (on) => {
      this.setBit(TmBTLed.BitRanges["rightTimeSpacer"][0], on);
    }

    toggleRightTimeSpacer = () => {
      this.flipBit(TmBTLed.BitRanges["rightTimeSpacer"][0]);
    };

    setLeftBlue = (on) => {
      this.setBit(TmBTLed.BitRanges["leftBlue"][0], on);
    }

    toggleLeftBlue = () => {
      this.flipBit(TmBTLed.BitRanges["leftBlue"][0]);
    };

    setRightBlue = (on) => {
      this.setBit(TmBTLed.BitRanges["rightBlue"][0], on);
    }
toggleRightBlue = () => {
    this.flipBit(TmBTLed.BitRanges["rightBlue"][0]);
};
setBlue = (on) => {
  this.setBit(TmBTLed.BitRanges["leftBlue"][0], on)
  this.setBit(TmBTLed.BitRanges["rightBlue"][0], on)
};
toggleBlue = () => {
  this.flipBit(TmBTLed.BitRanges["leftBlue"][0]);
  this.flipBit(TmBTLed.BitRanges["rightBlue"][0]);
};

setLeftRed = (on) => {
  this.setBit(TmBTLed.BitRanges["leftRed"][0], on);
}
toggleLeftRed = () => {
  this.flipBit(TmBTLed.BitRanges["leftRed"][0]);
};
setRightRed = (on) => {
  this.setBit(TmBTLed.BitRanges["rightRed"][0], on);
}
toggleRightRed = () => {
  this.flipBit(TmBTLed.BitRanges["rightRed"][0]);
};
setRed = (on) => {
  this.setBit(TmBTLed.BitRanges["leftRed"][0], on)
  this.setBit(TmBTLed.BitRanges["rightRed"][0], on)
};
toggleRed = () => {
  this.flipBit(TmBTLed.BitRanges["leftRed"][0]);
  this.flipBit(TmBTLed.BitRanges["rightRed"][0]);
};

setLeftYellow = (on) => {
  this.setBit(TmBTLed.BitRanges["leftYellow"][0], on);
}
toggleLeftYellow = () => {
  this.flipBit(TmBTLed.BitRanges["leftYellow"][0]);
};
setRightYellow = (on) => {
  this.setBit(TmBTLed.BitRanges["rightYellow"][0], on);
}
toggleRightYellow = () => {
  this.flipBit(TmBTLed.BitRanges["rightYellow"][0]);
};
flashingRightYellowInterval = null;
isFlashingRightYellow = false;
setFlashingRightYellow = (shouldFlash) => {
  if (!shouldFlash) {
    this.setRightYellow(false);
    if(this.flashingRightYellowInterval !== null) {
      clearInterval(this.flashingRightYellowInterval);
      this.flashingRightYellowInterval = null;
      this.isFlashingRightYellow = false;
    }
    return;
  }
  if (shouldFlash == this.isFlashingRightYellow) {
    return;
  }

  this.isFlashingRightYellow = shouldFlash;
  if (this.flashingRightYellowInterval !== null) {
    clearInterval(this.flashingRightYellowInterval);
    this.flashingRightYellowInterval = null;
  }
  this.flashingRightYellowInterval = setInterval(() => {
    this.toggleRightYellow();
  }, 500);
}


setYellow = (on) => {
  this.setBit(TmBTLed.BitRanges["leftYellow"][0], on)
  this.setBit(TmBTLed.BitRanges["rightYellow"][0], on)
};
toggleYellow = () => {
  this.flipBit(TmBTLed.BitRanges["leftYellow"][0]);
  this.flipBit(TmBTLed.BitRanges["rightYellow"][0]);
};

setFlashingYellow = (shouldFlash) => {
  if (!shouldFlash) {
    this.setYellow(false);
    if(this.flashingYellowInterval !== null) {
      clearInterval(this.flashingYellowInterval);
      this.flashingYellowInterval = null;
      this.isFlashingYellow = false;
    }
    return;
  }
  if (shouldFlash == this.isFlashingYellow) {
    return;
  }

  this.isFlashingYellow = shouldFlash;
  if (this.flashingYellowInterval !== null) {
    clearInterval(this.flashingYellowInterval);
    this.flashingYellowInterval = null;
  }
  this.flashingYellowInterval = setInterval(() => {
    this.toggleYellow();
  }, 500);
}


setFlashingBlue = (shouldFlash) => {
if (!shouldFlash) {
  this.setBlue(false);
  if(this.flashingBlueInterval !== null) {
    clearInterval(this.flashingBlueInterval);
    this.flashingBlueInterval = null;
    this.isFlashingBlue = false;
  }
  return;
}
if (shouldFlash == this.isFlashingBlue) {
  return;
}

this.isFlashingBlue = shouldFlash;
if (this.flashingBlueInterval !== null) {
  clearInterval(this.flashingBlueInterval);
  this.flashingBlueInterval = null;
}
this.flashingBlueInterval = setInterval(() => {
  this.toggleBlue();
}, 500);
}


setFlashingRed = (shouldFlash) => {
if (!shouldFlash) {
  this.setRed(false);
  if(this.flashingRedInterval !== null) {
    clearInterval(this.flashingRedInterval);
    this.flashingRedInterval = null;
    this.isFlashingRed = false;
  }
  return;
}
if (shouldFlash == this.isFlashingRed) {
  return;
}

this.isFlashingRed = shouldFlash;
if (this.flashingRedInterval !== null) {
  clearInterval(this.flashingRedInterval);
  this.flashingRedInterval = null;
}
this.flashingRedInterval = setInterval(() => {
  this.toggleRed();
}, 500);
}

setAllFlashing = (shouldFlash) => {
    this.setFlashingBlue(shouldFlash);
    this.setFlashingYellow(shouldFlash);
    this.setFlashingRed(shouldFlash);
}

setAllColors = (on) => {
    this.setBlue(on);
    this.setRed(on);
    this.setYellow(on);
} 

toggleAllColors = () => {
    this.toggleBlue();
    this.toggleRed();
    this.toggleYellow();
} 

setNumber = (numberString, right) => {
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
    const char = TmBTLed.CharMap[splittedChar[0]];
    const withDot = splittedChar.length === 2 && splittedChar[1] === ".";
    this.setLedSegments((right ? "right" : "left") + "Char" + (i + 1), char, withDot);
  }
};

setRevLightsFlashing = (flashStatus) => {
  if (flashStatus === 0 && this.revLightsFlashing !== 0) {
    this.revLightsFlashing = 0;
    this.setRevLights(0);
    if(this.revLightsFlashingIntervalId !== null) {
      clearInterval(this.revLightsFlashingIntervalId);
      this.revLightsFlashingIntervalId = null;
    }
    return;
  }
  if (flashStatus == this.revLightsFlashing) {
    return;
  }

  this.revLightsFlashing = flashStatus;
  if (this.revLightsFlashingIntervalId !== null) {
    clearInterval(this.revLightsFlashingIntervalId);
    this.revLightsFlashingIntervalId = null;
  }
  this.revLightsFlashingIntervalId = setInterval(() => {
    this.toggleRevLights();
  }, this.revLightsFlashing === 1 ? 500 : 250);
};

setRevLights = (percent) => {
    if (percent > 100) {
        return;
    }
    
    let firstByte = (1 << Math.floor((8/50) * percent)) - 1;
    let secondByte = 0;
    if (percent >= 50) {
        firstByte = 255;
        secondByte = (1 << Math.floor((7/50) * (percent - 50))) - 1;
    }
    const firstBitStart = TmBTLed.BitRanges["revLights1"][0];
    const firstBitArray = BitArray.fromNumber(firstByte).toJSON();
    while (firstBitArray.length < 8) {
      firstBitArray.unshift(0);
    }
    const secondBitStart = TmBTLed.BitRanges["revLights2"][0];
    const secondBitArray = BitArray.fromNumber(secondByte).toJSON();
    while (secondBitArray.length < 7) {
      secondBitArray.unshift(0);
    }
    for (let i = 0; i < firstBitArray.length; i++) {
      this.bitArray[firstBitStart + i] = parseInt(firstBitArray[i]);
      if (i < secondBitArray.length) {
        this.bitArray[secondBitStart + i] = parseInt(secondBitArray[i]);
      }
    }

    this.updateBuffer();
}

toggleRevLights = () => {
  this.revLightsOn = !this.revLightsOn;
  this.setRevLights(this.revLightsOn ? 100 : 0);
};


// Set data specific

setTemperature = (value, right) => {
  if (value < 0) {
    value = 0;
  }
  value = value.toFixed(0);
  if (right) {
    this.updateRightDisplay(value);
  } else {
    this.updateLeftDisplay(value);
  }
}

setFloat = (value, right) => {
    if (value < 0) {
      value = 0;
    }
    value = value.toFixed(1);
    if (right) {
      this.updateRightDisplay(value);
    } else {
      this.updateLeftDisplay(value);
    }
}

setInt = (value, right) => {
  value = parseInt(value);
  if (value < 0) {
    value = 0;
  }
  value = value.toFixed(0);
  if (right) {
    this.updateRightDisplay(value);
  } else {
    this.updateLeftDisplay(value);
  }
}

setRpm = (rpm, right) => {
    if (rpm >= 10000) {
      rpm = (rpm / 1000).toFixed(1) + "K";
    } else {
      rpm = rpm.toFixed(0);
    }
    if (right) {
      this.updateRightDisplay(rpm);
    } else {
      this.updateLeftDisplay(rpm);
    }
}

setTime = (time, right) => {

  if (isNaN(time)) {
    return;
  }

  if (right && this.indicationOnRightDisplay === null) {
    this.setRightTimeSpacer(true);
  } else if (!right && this.indicationOnLeftDisplay === null) {
    this.setLeftTimeSpacer(true);
  }
  let minutes = Math.floor(time / 60).toFixed(0);
  while (minutes.length < 2) {
    minutes = "0" + minutes;
  }
  let seconds = Math.floor(time % 60).toFixed(0);
  while (seconds.length < 2) {
    seconds = "0" + seconds;
  }
  const timeString = minutes + seconds;
  if (right) {
    this.updateRightDisplay(timeString);
  } else {
    this.updateLeftDisplay(timeString);
  }
}


}

export default TmBTLed;


