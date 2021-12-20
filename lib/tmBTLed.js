/*
 * Main library to drive the TM BT Led
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const NobleMain = require('@abandonware/noble/lib/noble');
const NobleBinding = require("@abandonware/noble/lib/hci-socket/bindings");
const noble = new NobleMain(NobleBinding);

require("usb/build/Release/usb_bindings.node");

const fs = require("fs");
const BitArray = require("node-bitarray");
const osLocale = require('os-locale');
const convert = require('convert-units');

const yargs = require("yargs");
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const startTime = new Date().getTime();
function exitHandler(message, exitCode) {
    if (message) {
        console.error(message);
    }
    const endTime =  new Date().getTime();
    console.log("Ran for " + ((endTime - startTime) / 1000 / 60).toFixed(1) + " minutes");
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

//do something when app is closing
process.on('exit', exitHandler);
//catches uncaught exceptions
process.on('uncaughtException', exitHandler); 

class TmBTLed {

    message;
    initCallback;
    updateInterval = 250;
    targetInterval = argv?.interval || 17.5;
    metric = true;
    intervalId = null;
    peripheral = null;
    // gameConnectionStarted = false;
 
    overrideTimerLeftDisplay = null; // Timer
    overrideTimerRightDisplay = null;  // Timer
    flashingYellowInterval = null;
    isFlashingYellow = false;
    flashingBlueInterval = null;
    isFlashingBlue = false;
    flashingRedInterval = null;
    isFlashingRed = false;

    flashingLeftYellowInterval = null;
    isFlashingLeftYellow = false;    
    flashingRightYellowInterval = null;
    isFlashingRightYellow = false;    
    flashingRightRedInterval = null;
    isFlashingRightRed = false;    



    revLimitIntervalId = null;
    revLightsFlashingIntervalId = null;
    revLightsFlashing = 0;
    revLightsOn = false;
    currentLeftButton = null;
    currentRightButton = null;

    gearDotFlashingIntervalId = null;
    gearDotFlashing = 0;

    static EXT = '.dump';
      
    static BitRanges = {
        "revLights1":       [8, 15],
        "leftBlue":         [16, 16],
        "revLights2":       [17, 23],
        "leftChar1":        [24, 39],
        "leftChar2":        [40, 55],
        "leftTimeSpacer":   [48, 48],
        "leftChar3":        [56, 71],
        "leftRed":          [64, 64],
        "leftChar4":        [72, 87],
        "leftYellow":       [80, 80],  
        "gearDot":          [88, 88],
        "gear":             [89, 95],
        "rightChar1":       [96, 111],
        "rightYellow":      [104, 104],
        "rightChar2":       [112, 127],
        "rightTimeSpacer":  [120, 120],
        "rightChar3":       [128, 143],
        "rightRed":         [136, 136],
        "rightChar4":       [144, 159],
        "rightBlue":        [152, 152],
        "revLightsGreen":   [11, 15],
        "revLightsRed1":    [8, 10],
        "revLightsRed2":    [22, 23],
        "revLightsBlue":    [17, 21],                
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
        "-": "11000000 0000000",
        "+": "11000000 0010010"
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
    defaultBitArray;

    constructor(initCallback) {

        if (argv.metric) {
          this.metric = true;
          console.log("Forcing metric units")
        } else if (argv.imperial) {
            this.metric = false;
            console.log("Forcing imperial units")
        } else {
          osLocale().then(loc => {
            if(loc.toLowerCase() === "en-us") {
              this.metric = false;
              console.log("Using imperial units")
            } else {
              this.metric = true;
              console.log("Using metric units")
            }
          });
        }

        if (initCallback) {
          this.initCallback = initCallback;
        }

        this.defaultBitArray = this.bitArray.slice();

        this.buffer = new Buffer.alloc(20);
        this.updateBuffer();
        this.initNoble(); 
    }

    setCallbacks = callbacks => {
      this.callbacks = callbacks;
    }

    initNoble = () => {
        let myself = this;
        noble.stopScanning();

        noble.on('stateChange', function (state) {
          if (state === 'poweredOn') {
            console.log("Starting scan...");
            noble.startScanning();
          } else {
            noble.stopScanning();
          }
        });

        let discovered = false;
        noble.on('discover', function (peripheral) {

          if (!discovered) {
            console.log("Discovering devices. Please press both pair buttons now...");
            discovered = true;
          }
          // Check if a dump  exists in the current directory.
          fs.access(peripheral.uuid + TmBTLed.EXT, fs.constants.F_OK, (err) => {
            if (!err) {
              console.log(` -- Found device config ${peripheral.uuid}`);

              myself.quickConnect(peripheral);
            }
          });
        });
    }

    showTemporary = (message, rightMessage) => {
      this.message = message;
      this.showTemporaryLeft(rightMessage ? this.message : this.message.substr(0,4).toUpperCase());
      this.showTemporaryRight(rightMessage ? rightMessage : this.message.substr(4,4).toUpperCase()); 
    }

    quickConnect = (p) => {
        noble.stopScanning();
        p.connect(async (error) => {
            if (error) {
              console.log(`Connect error: ${error}`);
              noble.startScanning([], true);
              return;
            }

            this.peripheral = p;
            this.peripheral.discoverAllServicesAndCharacteristics((error, services, characteristics) => {
                noble.on('connectionParameterUpdateRequest', (minInterval, maxInterval) => {
                  console.log("Refresh interval was forcefully set to ", maxInterval, " ms");
                  this.updateInterval = maxInterval;
                  if (this.intervalId) {
                    console.log("Restarting loop...");
                    this.startLoop();
                  }
                });
      
                noble.on('connectionUpdateCompleted', (status, handle, interval, latency, supervisionTimeout) => {
                    console.log("Refresh interval has been changed to ", interval, " ms");
                    this.updateInterval = interval;
                    this.startLoop();
                });
      
                const meta = this.loadData(this.peripheral);
                const [report1, report2, report3, report4 ] = this.setData(this.peripheral, meta);
      
                if (!report1) { // Report 1
                    console.log('Warning - no event characteristic found. Mode buttons won\'t work.');
                } else {
                    report1.on("data", this.handleEvent);
                }
      
                // -> This should trigger the startLoop
                if (this.initCallback) {
                  console.log("Init done. Waiting for data...");
                  this.initCallback();
                }

                if (!this.message) {
                  this.showTemporary("NO  GAME");
                }
            });
        });
    }

    setPerformanceMode = () => {
        if (!this.peripheral) {
            return;
        }
        console.log("Switching to performance mode");
        this.peripheral.connUpdateLe(this.targetInterval, this.targetInterval, 0, 3000);
    }

    setPowerSaveMode = () => {
        if (!this.peripheral) {
            return;
        }
        console.log("Switching to power save mode");
        this.peripheral.connUpdateLe(125, 250, 0, 3000);
    }

    startLoop = () => {
        const _this = this;
        if (_this.intervalId) {
          console.log('Stopping running loop...');
          clearInterval(_this.intervalId);
        }

        console.log('Starting loop with refresh interval: ', this.updateInterval, ' ms...');

        let sentBuffer = new Buffer.alloc(_this.buffer.length);
        this.intervalId = setInterval(() => {
          if (!sentBuffer.equals(_this.buffer)) {
            _this.peripheral.writeHandle("58", _this.buffer, true);
            _this.buffer.copy(sentBuffer);
          }
        }, this.updateInterval);
    } 

    printLine = (line) => {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(line);
    }

    // Read mode button input
    handleEvent = (data) => {
        if (!this.callbacks || !this.callbacks.onLeftPreviousMode || !this.callbacks.onLeftNextMode || !this.callbacks.onRightNextMode || !this.callbacks.onRightPreviousMode) {
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
    
      console.log('Initializing services...');   
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

    /**
     * Setter for gear, display, rev lights and leds
     * Will be used by game specific scripts
     * Boolean parameter "right" display data on the right screen
     */

    setGear = gear => {
        let gearCode = "1111111";
        switch(gear) {
          case -1:
            gearCode = "1001100";
            break;		
          case 0:
            gearCode = "1001000"; // <- N 
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
            gearCode = "1000000"; // <- 0
            break;      
          case undefined:
          case false:
          default:
            gearCode = "1111111";
            break;      
        }
        this.setLedSegments("gear", gearCode);
    };
    
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
            percent = 100;
        }
        
        let firstByte = (1 << Math.floor((8/50) * percent)) - 1;
        let secondByte = 0;
        if (percent >= 50) {
            firstByte = 255;
            secondByte = (1 << Math.floor((7/50) * (percent - 50))) - 1;
        }
        const firstBitStart = TmBTLed.BitRanges["revLights1"][0];
        const firstBitEnd = TmBTLed.BitRanges["revLights1"][1] + 1;
        let firstBitArray = BitArray.fromNumber(firstByte).toJSON();
        while (firstBitArray.length < 8) {
          firstBitArray.unshift(0);
        }
        // Prevent overflow
        firstBitArray = firstBitArray.slice(0, firstBitEnd - firstBitStart);
        const secondBitStart = TmBTLed.BitRanges["revLights2"][0];
        const secondBitEnd = TmBTLed.BitRanges["revLights2"][1] + 1;
        let secondBitArray = BitArray.fromNumber(secondByte).toJSON();
        while (secondBitArray.length < 7) {
          secondBitArray.unshift(0);
        }
        // Prevent overflow
        secondBitArray = secondBitArray.slice(0, secondBitEnd - secondBitStart);
        for (let i = 0; i < firstBitArray.length; i++) {
          this.bitArray[firstBitStart + i] = parseInt(firstBitArray[i]);
          if (i < secondBitArray.length) {
            this.bitArray[secondBitStart + i] = parseInt(secondBitArray[i]);
          }
        }

        this.updateBuffer();
    }

    setRevLightsWithoutGreen = (percent, min = 0) => {
      if (percent > 100) {
          percent = 100;
      }

      if (percent < min) {
        percent = 0;
      } else {
        percent = (percent - min) / (100 - min) * 100;
      }
      
      if (percent < 50) {
        this.setRevLightsRed(Math.floor((5/50) * (percent)));
        this.setRevLightsBlue(0);
      } else if (percent >= 50) {
        this.setRevLightsRed(5);
        this.setRevLightsBlue(Math.floor((5/50) * (percent - 50)));
      } else {
        this.setRevLightsRed(0);
        this.setRevLightsBlue(0);
      }


      this.updateBuffer();
  }

    setRevLightsGreen = (num = 0) => {
      const firstBitStart = TmBTLed.BitRanges["revLightsGreen"][0];
      const firstBitEnd = TmBTLed.BitRanges["revLightsGreen"][1];
      for (let i = firstBitEnd; i >= firstBitStart; i--) {
        if ((firstBitEnd - i - num + 1) <= 0) {
          this.bitArray[i] = 1;
        } else {
          this.bitArray[i] = 0;
        }
      }

      this.updateBuffer();
    }
    
    setRevLightsRed = (num = 0) => {
      const firstBitStart = TmBTLed.BitRanges["revLightsRed1"][0];
      const firstBitEnd = TmBTLed.BitRanges["revLightsRed1"][1];
      const secondBitStart = TmBTLed.BitRanges["revLightsRed2"][0];
      const secondBitEnd = TmBTLed.BitRanges["revLightsRed2"][1];
      for (let i = firstBitEnd; i >= firstBitStart; i--) {
        if ((firstBitEnd - i + 1 - num) <= 0) {
          this.bitArray[i] = 1;
        } else {
          this.bitArray[i] = 0;
        }
      }
      for (let i = secondBitEnd; i >= secondBitStart; i--) {
          if ((secondBitEnd - i - num + (firstBitEnd - firstBitStart + 1) + 1) <= 0) {
            this.bitArray[i] = 1;
          } else {
            this.bitArray[i] = 0;
          }
      } 

      this.updateBuffer();
    }    


    setRevLightsBlue = (num = 0) => {
      const firstBitStart = TmBTLed.BitRanges["revLightsBlue"][0];
      const firstBitEnd = TmBTLed.BitRanges["revLightsBlue"][1];
      for (let i = firstBitEnd; i >= firstBitStart; i--) {
        if ((firstBitEnd - i - num + 1) <= 0) {
          this.bitArray[i] = 1;
        } else {
          this.bitArray[i] = 0;
        }
      }

      this.updateBuffer();
    }

    toggleRevLights = () => {
      this.revLightsOn = !this.revLightsOn;
      this.setRevLights(this.revLightsOn ? 100 : 0);
    };

    setTemperature = (value, right) => { // expects C
      if (value < 0) {
        value = 0;
      }

      if (!this.metric) {
        value = convert(value).from("C").to("F");    
      }

      if (value >= 1000) {
        value = value.toFixed(0);
      } else {
        value = value.toFixed(1);
      }

      this.updateDisplay(value, right);
    }

    setWeight = (value, right) => { // expects kg
      if (value < 0) {
        value = 0;
      }

      if (!this.metric) {
        value = convert(value).from("kg").to("lb").toFixed(1);
      } else {
        value = value.toFixed(1);
      }

      this.updateDisplay(value, right);
    }

    setFloat = (value, right) => {
        if (value < 0) {
          value = 0;
        }
        value = value.toFixed(1);
        this.updateDisplay(value, right);
    }

    setInt = (value, right) => {
      value = parseInt(value);
      if (value < 0) {
        value = 0;
      }
      value = value.toFixed(0);
      this.updateDisplay(value, right);
    }

    setSpeed = (value, right) => { // expects Kmh
      value = parseInt(value);
      if (value < 0) {
        value = 0;
      }
      if (!this.metric) {
        value = convert(value).from("km/h").to("m/h").toFixed(0);
      } else {
        value = value.toFixed(0);
      }
      this.updateDisplay(value, right);
    }

    setRpm = (rpm, right) => {
        if (rpm < 0) {
          rpm = 0;
        }

        if (rpm >= 10000) {
          rpm = (rpm / 1000).toFixed(1) + "K";
        } else {
          rpm = rpm.toFixed(0);
        }
        this.updateDisplay(rpm, right);
    }

    setDiffTime = (time, right) => {
      let timeString = "----";
      if (time === null || isNaN(time) || time >= 2147483647) {
        this.updateDisplay(timeString, right);
        if ((right && this.overrideTimerRightDisplay === null) || (!right && this.overrideTimerLeftDisplay === null)) {
          this.setTimeSpacer(true, right);
        }
        return;
      }

      const isNegative = time < 0;
      time = Math.abs(time) / 1000;

      if (time > 99.99) {
        timeString = "99.9";
      } else if (time < 10) {
        timeString = time.toFixed(2);
      } else {
        timeString = time.toFixed(1);
      }

      if (isNegative) {
        timeString = "-" + timeString;
      } else {
        timeString = "+" + timeString;
      }
      this.updateDisplay(timeString, right);
    };

    setTime = (time, right) => { // time in Milliseconds
      let timeString = "----";
      if (time === 0 || time === null || isNaN(time) || time >= 2147483647) {
        this.updateDisplay(timeString, right);
        if (right && this.overrideTimerRightDisplay === null || (!right && this.overrideTimerLeftDisplay === null)) {
          this.setTimeSpacer(true, right);
        }
        return;
      }

      this.setTimeSpacer(false, right);
      let timeInSeconds = Math.abs(time) / 1000;
      let minutes = Math.floor(timeInSeconds / 60).toFixed(0);
      let seconds = Math.floor(timeInSeconds % 60).toFixed(0);
      while (seconds.length < 2) {
        seconds = "0" + seconds;
      }

      let milliseconds = (time & 1000).toFixed(0);
      while (milliseconds.length < 3) {
        milliseconds += "0";
      }

      if (timeInSeconds === 0) {
        timeString = "0.000";
      }
      if (parseInt(minutes) > 99) {
        timeString = "9999";
        if (right && this.overrideTimerRightDisplay === null || this.overrideTimerLeftDisplay === null) {
          this.setTimeSpacer(true, right);
        }
      } else if (timeInSeconds < 10) {
        timeString = "" + timeInSeconds;
        while (timeString.length < 5) {
          timeString = timeString + "0";
        }
      } else if (parseInt(minutes) < 1) {
        timeString = seconds + "." + milliseconds.substring(0,2);
      } else if (parseInt(minutes) < 10) {
        timeString = minutes + "." + seconds + "." + milliseconds.substring(0,1);
      } else {
        timeString = minutes + seconds;
        if (right && this.overrideTimerRightDisplay === null || this.overrideTimerLeftDisplay === null) {
          this.setTimeSpacer(true, right);
        }
      }

      this.updateDisplay(timeString, right);
    }

    // Manipulation of bit array which holds the current state of all leds and led segment displays
    updateBuffer = () => {
        BitArray.toBuffer(this.bitArray).copy(this.buffer);
    };  

    resetBuffer = () => {
        this.bitArray = this.defaultBitArray.slice();
        this.updateBuffer();
    }

    reset = () => {
      this.setAllColors(false);
      this.setAllFlashing(false);
      this.setRevLightsFlashing(0);
      this.setGearDotFlashing(0);
      this.resetBuffer();
    }

    flipBit = (bit) => {
      this.bitArray[bit] = this.bitArray[bit] === 1 ? 0 : 1;
      this.updateBuffer();
    }

    setBit = (bit, on, inverted) => {
      this.bitArray[bit] = on ? (inverted ? 0 : 1) : (inverted ? 1 : 0);
      this.updateBuffer();
    }

    setLedSegments = (type, bitString, withDot) => {
        let bits = (bitString || "").split("");
        const bitStart = TmBTLed.BitRanges[type][0];
        const bitEnd = TmBTLed.BitRanges[type][1] + 1;

        // Prevent overflow
        bits = bits.slice(0, bitEnd - bitStart);
        for(let i = 0; i < bits.length; i++) {
          // TODO: Daten nicht als String erhalten
          if (bits[i] === " ") {
            // Skip this bit
            continue;
          }
          this.bitArray[bitStart + i] = parseInt(bits[i]);
        }
        if (bits.length > 9) {
          this.bitArray[bitStart + 9] = withDot ? 1 : 0;
        }
        this.updateBuffer();
    };

    setLeftDisplay = str => {
      str = new String(str);
      while(str.length < 4) {
        str = " " + str;
      }

      str.split("").slice(0,4).forEach((c, i) => {
        this.setLedSegments("leftChar" + (i + 1), TmBTLed.CharMap[c], false);
      });
    }

    showingTemporaryLeft = null;
    delayTemporaryLeftTimeout = null;
    scrollTemporaryLeftInterval = null;
    showTemporaryLeft = (str, duration) => {
      duration = duration || 3000;

      if (str === this.showingTemporaryLeft) {
        return;
      }
      this.showingTemporaryLeft = str;
      this.clearTemporaryLeftTimers();

      this.setLeftTimeSpacer(false);

      this.setLeftDisplay(str);

      if (str.length > 4 && str.substring) {
        let offset = 1;
        this.delayTemporaryLeftTimeout = setTimeout(() => {
          this.scrollTemporaryLeftInterval = setInterval(() => {
            if (offset >= str.length - 3) {
              clearInterval(this.scrollTemporaryLeftInterval);
              this.scrollTemporaryLeftInterval = null;
              return;
            }
            this.setLeftDisplay(str.substring(offset++));
          }, 200);
        }, 500);
      }
      
      this.overrideTimerLeftDisplay = setTimeout(() => {
        this.overrideTimerLeftDisplay = null;
        this.showingTemporaryLeft = null;
        this.clearTemporaryLeftTimers();
      }, duration);
    }

    clearTemporaryLeftTimers = () => {
      if (this.overrideTimerLeftDisplay !== null) {
        clearTimeout(this.overrideTimerLeftDisplay);
        this.overrideTimerLeftDisplay = null;
      }
      if (this.scrollTemporaryLeftInterval) {
        clearInterval(this.scrollTemporaryLeftInterval);
        this.scrollTemporaryLeftInterval = null;
      }
      if (this.delayTemporaryLeftTimeout) {
        clearTimeout(this.delayTemporaryLeftTimeout);
        this.delayTemporaryLeftTimeout = null;
      }
    }

    updateLeftDisplay = (str, isNumber) => {
      if (this.overrideTimerLeftDisplay !== null) {
        return;
      }
      if(str.match(/[\.\d]/)) {
        this.setNumber(str, false);
      } else {
        this.setLeftDisplay(str);
      }
    }

    setRightDisplay = str => {
      str = new String(str);
      while(str.length < 4) {
        str = " " + str;
      }

      str.split("").slice(0,4).forEach((c, i) => {
        this.setLedSegments("rightChar" + (i + 1), TmBTLed.CharMap[c], false);
      })
    }

    updateDisplay = (str, right) => {
      if (right) {
        this.updateRightDisplay(str);
      } else {
        this.updateLeftDisplay(str);
      }
    }

    showingTemporaryRight = null;
    delayTemporaryRightTimeout = null;
    scrollTemporaryRightInterval = null;
    showTemporaryRight = (str, duration) => {
      duration = duration || 3000;

      if (str === this.showingTemporaryRight) {
        return;
      }
      this.showingTemporaryRight = str;
      this.clearTemporaryRightTimers();

      this.setRightTimeSpacer(false);

      this.setRightDisplay(str);

      if (str.length > 4 && str.substring) {
        let offset = 1;
        this.delayTemporaryRightTimeout = setTimeout(() => {
          this.scrollTemporaryRightInterval = setInterval(() => {
            if (offset >= str.length - 3) {
              clearInterval(this.scrollTemporaryRightInterval);
              this.scrollTemporaryRightInterval = null;
              return;
            }
            this.setRightDisplay(str.substring(offset++));
          }, 200);
        }, 500);
      }
      
      this.overrideTimerRightDisplay = setTimeout(() => {
        this.overrideTimerRightDisplay = null;
        this.showingTemporaryRight = null;
        this.clearTemporaryRightTimers();
      }, duration);
    }

    clearTemporaryRightTimers = () => {
      if (this.overrideTimerRightDisplay !== null) {
        clearTimeout(this.overrideTimerRightDisplay);
        this.overrideTimerRightDisplay = null;
      }
      if (this.scrollTemporaryRightInterval) {
        clearInterval(this.scrollTemporaryRightInterval);
        this.scrollTemporaryRightInterval = null;
      }
      if (this.delayTemporaryRightTimeout) {
        clearTimeout(this.delayTemporaryRightTimeout);
        this.delayTemporaryRightTimeout = null;
      }
    }

    updateRightDisplay = (str) => {
      if (this.overrideTimerRightDisplay !== null) {
        return;
      }

      if(str.match(/[\.\d]+/) !== null) {
        this.setNumber(str, true);
      } else {
        this.setRightDisplay(str);
      }
    }

    updateDisplay = (str, right) => {
      if (right) {
        this.updateRightDisplay(str);
      } else {
        this.updateLeftDisplay(str);
      }
    };

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

    setGearDot = (on) => {
      this.setBit(TmBTLed.BitRanges["gearDot"][0], on, true);
    };

    setGearDotFlashing = (flashStatus) => {
      if (flashStatus === 0 && this.gearDotFlashing !== 0) {
        this.gearDotFlashing = 0;
        this.setGearDot(false);
        if(this.gearDotFlashingIntervalId !== null) {
          clearInterval(this.gearDotFlashingIntervalId);
          this.gearDotFlashingIntervalId = null;
        }
        return;
      }
      if (flashStatus == this.gearDotFlashing) {
        return;
      }

      this.gearDotFlashing = flashStatus;
      if (this.gearDotFlashingIntervalId !== null) {
        clearInterval(this.gearDotFlashingIntervalId);
        this.gearDotFlashingIntervalId = null;
      }
      this.gearDotFlashingIntervalId = setInterval(() => {
        this.toggleGearDot();
      }, this.gearDotFlashing === 1 ? 500 : 250);
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

    setTimeSpacer = (on, right) => {
      if (right) {
        this.setRightTimeSpacer(on);
      } else {
        this.setLeftTimeSpacer(on);
      }
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

    setFlashingRightRed = (shouldFlash) => {
      if (!shouldFlash) {
        this.setRightRed(false);
        if(this.flashingRightRedInterval !== null) {
          clearInterval(this.flashingRightRedInterval);
          this.flashingRightRedInterval = null;
          this.isFlashingRightRed = false;
        }
        return;
      }
      if (shouldFlash == this.isFlashingRightRed) {
        return;
      }

      this.isFlashingRightRed = shouldFlash;
      if (this.flashingRightRedInterval !== null) {
        clearInterval(this.flashingRightRedInterval);
        this.flashingRightRedInterval = null;
      }
      this.flashingRightRedInterval = setInterval(() => {
        this.toggleRightRed();
      }, 500);
    }

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

    setFlashingLeftYellow = (shouldFlash) => {
      if (!shouldFlash) {
        this.setLeftYellow(false);
        if(this.flashingLeftYellowInterval !== null) {
          clearInterval(this.flashingLeftYellowInterval);
          this.flashingLeftYellowInterval = null;
          this.isFlashingLeftYellow = false;
        }
        return;
      }
      if (shouldFlash == this.isFlashingLeftYellow) {
        return;
      }

      this.isFlashingLeftYellow = shouldFlash;
      if (this.flashingLeftYellowInterval !== null) {
        clearInterval(this.flashingLeftYellowInterval);
        this.flashingLeftYellowInterval = null;
      }
      this.flashingLeftYellowInterval = setInterval(() => {
        this.toggleLeftYellow();
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
        //this.setFlashingRightRed(shouldFlash);
        //this.setFlashingLeftYellow(shouldFlash);
        //this.setFlashingRightYellow(shouldFlash);
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
}


class Setup {
  constructor() {
      this.initNoble();
  }

  initNoble = () => {
    let _this = this;
    noble.stopScanning();

    noble.on('stateChange', function (state) {
      if (state === 'poweredOn') {
        console.log("Starting scan...");
        noble.startScanning();
      } else {

        noble.stopScanning();
        // process.exit(0);
      }
    });

    let discovered = false;
    noble.on('discover', function (peripheral) {
      if (!discovered) {
        console.log("Discovering devices. Please press both pair buttons now...");
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
        console.log("Dump written successfully. Run test.bat for a demo or run.bat for autodetect game mode.");
        process.exit();
      })            
    })
  } 
}

module.exports = {
  TmBTLed, 
  Setup
};
