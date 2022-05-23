/*
 * Game client for Assetto corsa series
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const AssettoCorsaSharedMemory = require("../AssettoCorsaSharedMemory/build/Release/AssettoCorsaSharedMemory.node");
const AbstractClient = require('../lib/abstractClient.js');
const path = require('path');

const loadableConfigName = "assetto.config.js";
const defaultConfig = {
  leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP"],
  rightModesAcc: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "PRED LAP", "POSITION", "LAP", "LAPS LEFT"],
  rightModesAssetto: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};


// SM Version 1.7
class ACC extends AbstractClient {
    maxRpm = 0;
    isACC = true;
    refreshInterval = null;

    config;
    modeMapping;

    physics;
    graphics;
    statics;

    constructor(tmBtLed) {
      if (!tmBtLed) {
          throw "No TM BT Led lib found.";
      }

      super(tmBtLed);    

      this.modeMapping = {
        "SPEED": this.showSpeed,
        "RPM": this.showRpm,
        "FUEL": this.showFuel,
        "TYRETEMP": this.showTyreTemp,
        "BRAKETEMP": this.showBrakeTemp,

        "LAPTIME": this.showCurrentLap,
        "DELTA": this.showDelta,
        "LAST LAP": this.showLastLap,
        "BEST LAP": this.showBestLap,
        "PRED LAP": this.showPredLap,
        "POSITION": this.showPosition,
        "LAP": this.showLapNumber,
        "LAPS LEFT": this.showLapsLeft
      };

      try {
          this.config = require(path.dirname(process.execPath) + "/" + loadableConfigName);
          if (this.config?.leftModes && this.config?.rightModesAcc && this.config?.rightModesAssetto) {
              console.log("Found custom config");
          } else {
              throw "No custom config";
          }
      } catch (e) {
          this.config = defaultConfig;
      }

      this.setCallbacks({
          onLeftPreviousMode: this.leftPreviousMode,
          onLeftNextMode: this.leftNextMode,
          onRightPreviousMode: this.rightPreviousMode,
          onRightNextMode: this.rightNextMode
      });
      this.setModes(this.config?.leftModes, this.config?.rightModesAcc);

      AssettoCorsaSharedMemory.initMaps();
    }

    startClient = () =>  {
        this.refreshInterval = setInterval(() => {
            this.updateValues();
        }, 1000 / 60); // 60 Hz
    }

    stopClient = () => {
        if (this.refreshInterval) {
          console.log("Stopping interval")
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        AssettoCorsaSharedMemory.cleanup();
    }

    updateValues = () => {
        this.physics = AssettoCorsaSharedMemory.getPhysics();
        this.statics = AssettoCorsaSharedMemory.getStatics();
        this.isACC = !(this.statics.smVersion < 1.8);

        if (this.isACC) {
          this.graphics = AssettoCorsaSharedMemory.getGraphicsACC();
          this.rightModes = this.config?.rightModesAcc;
        } else {
          this.graphics = AssettoCorsaSharedMemory.getGraphicsAssetto();
          this.rightModes = this.config?.rightModesAssetto;
        }

        this.tmBtLed.setGear(this.physics.gear - 1);

        // RevLights & PitLimiter
        if (this.physics.pitLimiterOn === 1 || this.graphics.isInPitLane || this.graphics.isInPit) {
          this.tmBtLed.setRevLightsFlashing(1);
        } else {
          this.tmBtLed.setRevLightsFlashing(0);
        }
        
        if (this.tmBtLed.revLightsFlashing !== 1) {
          let rpmPercent = this.physics.rpms / this.statics.maxRpm * 100;

          if (this.config?.blueRevLightsIndicateShift) {
            this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);

            if (rpmPercent >= 99.5) {
              this.tmBtLed.setRevLightsBlueFlashing(true);
            } else {
              this.tmBtLed.setRevLightsBlueFlashing(false);
            }
          } else {
            if (rpmPercent < 50) {
              rpmPercent = 0;
            } else {
              rpmPercent = (rpmPercent - 50) / 50 * 100;
            }
  
            this.tmBtLed.setRevLights(rpmPercent >= 98 ? 100 : rpmPercent);
          }
        }

        if (this.physics.isEngineRunning === 1) {
          this.tmBtLed.setGearDot(true);
        } else {
          this.tmBtLed.setGearDot(false);
        }

        // Flags
        switch(this.graphics.flag) {
          case 1:
            this.tmBtLed.setFlashingBlue(true);
            break      
          case 2:
            this.tmBtLed.setFlashingYellow(true);
            break         
          case 8:
          case 6:
            this.tmBtLed.setFlashingRed(true);
            break                      
          case -1:
          case 0:
          default:
            if (this.tmBtLed.isFlashingYellow) {
              this.tmBtLed.setFlashingYellow(false);
            }
            if (this.tmBtLed.isFlashingRed) {
              this.tmBtLed.setFlashingRed(false);
            }
            if (this.tmBtLed.isFlashingBlue) {
              this.tmBtLed.setFlashingBlue(false);
            }
            break
        }

        // Set left display according to left modes array and currentLeftMode array index
        if (this.currentLeftMode <= this.leftModes.length) {
          const leftDataProcessor = this.modeMapping[this.leftModes[this.currentLeftMode]];
          if (typeof leftDataProcessor === "function") {
              leftDataProcessor(false);
          }
        }

        // Set right display according to right modes array and currentRightMode array index
        // Second boolean parameter (true) in setter displays value in right display
        if (this.currentRightMode <= this.rightModes.length) {
            const rightDataProcessor = this.modeMapping[this.rightModes[this.currentRightMode]];
            if (typeof rightDataProcessor === "function") {
                rightDataProcessor(true);
            }
        }
    };

    showSpeed = (onRight) => {
      this.tmBtLed.setSpeed(this.physics.speedKmh, onRight);
    };

    showRpm = (onRight) => {
      this.tmBtLed.setRpm(this.physics.rpms, onRight);
    };
    showFuel = (onRight) => {
      this.tmBtLed.setWeight(this.physics.fuel, onRight);
    };
    showTyreTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.physics.tyreCoreTemperature, onRight);
    };
    showBrakeTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.physics.brakeTemp, onRight);
    };
 
    showCurrentLap = (onRight) => {
      this.tmBtLed.setTime(this.graphics.iCurrentTime, onRight);
    };
    showDelta = (onRight) => {
      this.tmBtLed.setDiffTime(this.graphics.iDeltaLapTime, onRight);
    };
    showLastLap = (onRight) => {
      this.tmBtLed.setTime(this.graphics.iLastTime, onRight);
    };
    showBestLap = (onRight) => {
      this.tmBtLed.setTime(this.graphics.iBestTime, onRight);
    };
    showPredLap = (onRight) => {
      this.tmBtLed.setTime(this.graphics.iEstimatedLapTime, onRight);
    };
    showPosition = (onRight) => {
      this.tmBtLed.setInt(this.graphics.position, onRight);
    };
    showLapNumber = (onRight) => {
      this.tmBtLed.setInt(this.graphics.completedLaps + 1, onRight);
    };
    showLapsLeft = (onRight) => {
      this.tmBtLed.setInt(this.graphics.numberOfLaps < 1000 ? (this.graphics.numberOfLaps - this.graphics.completedLaps) : 0, onRight);
    };    
}

module.exports = ACC;
