/*
 * Game client for rFactor2
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const rF2SharedMemory = require("../rF2SharedMemory/build/Release/rF2SharedMemory.node");
const AbstractClient = require('../lib/abstractClient.js');
const path = require('path');

const loadableConfigName = "rf2.config.js";
const defaultConfig = {
  leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "TYREPRESS", "BRAKETEMP", "OILTEMP"],
  rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};

class rF2 extends AbstractClient {
    scoring = {};
    telemetry = {};
    refreshInterval = null;

    config;
    modeMapping;

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
        "TYREPRESS": this.showTyrePress,
        "BRAKETEMP": this.showBrakeTemp,
        "OILTEMP": this.showOilTemp,

        "LAPTIME": this.showCurrentLap,
        "LAST LAP": this.showLastLap,
        "BEST LAP": this.showBestLap,
        "POSITION": this.showPosition,
        "LAP": this.showLapNumber,
        "LAPS LEFT": this.showLapsLeft
      };

      try {
          this.config = require(path.dirname(process.execPath) + "/" + loadableConfigName);
          if (this.config?.leftModes && this.config?.rightModes) {
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
      this.setModes(this.config?.leftModes, this.config?.rightModes);

      rF2SharedMemory.init();
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
        rF2SharedMemory.cleanup();
    }

    updateValues = () => {

        const telemetry = rF2SharedMemory.getTelemetry();
        const scoring = rF2SharedMemory.getScoring();
        
        if (telemetry && Object.keys(telemetry).length) {
          this.telemetry = telemetry;
        }

        if (scoring && Object.keys(scoring).length) {
          this.scoring = scoring;
        }

        this.tmBtLed.setGear(this.telemetry.mGear);

        // RevLights & PitLimiter
        if (this.telemetry.mSpeedLimiter === 1) {
          this.tmBtLed.setRevLightsFlashing(1);
        } else {
          this.tmBtLed.setRevLightsFlashing(0);
        }
        
        if (this.tmBtLed.revLightsFlashing !== 1) {
          let rpmPercent = this.telemetry.mEngineRPM / this.telemetry.mEngineMaxRPM * 100;
          if (rpmPercent < 50) {
            rpmPercent = 0;
          } else {
            rpmPercent = (rpmPercent - 50) / 50 * 100;
          }

          this.tmBtLed.setRevLights(rpmPercent >= 98 ? 100 : rpmPercent);
        }

        /*if (physics.isEngineRunning === 1) {
          this.tmBtLed.setGearDot(true);
        } else {
          this.tmBtLed.setGearDot(false);
        }*/

        // Flags
        switch(this.scoring.mFlag) {
          case 6:
            this.tmBtLed.setFlashingBlue(true);
            break                      
          case 0:
          default:
            if (this.tmBtLed.isFlashingBlue) {
              this.tmBtLed.setFlashingBlue(false);
            }
            break;
        }

        switch(this.scoring.mIndividualPhase) {
          case 7:
            this.tmBtLed.setFlashingRed(true);
            break 
         /* case 6:
            this.tmBtLed.setFlashingYellow(true);
            break                                   */
          default:
            /*if (this.tmBtLed.isFlashingYellow) {
              this.tmBtLed.setFlashingYellow(false);
            }*/
            if (this.tmBtLed.isFlashingRed) {
              this.tmBtLed.setFlashingRed(false);
            }
            break;
        }

        switch(this.scoring.mSectorFlag) {
          case 33:
            if (this.tmBtLed.isFlashingYellow) {
              this.tmBtLed.setFlashingYellow(false);
            }
            break 
         /* case 6:
            this.tmBtLed.setFlashingYellow(true);
            break                                   */
          default:
            /*if (this.tmBtLed.isFlashingYellow) {
              this.tmBtLed.setFlashingYellow(false);
            }*/
            this.tmBtLed.setFlashingYellow(true);
            break;
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
      this.tmBtLed.setSpeed(this.telemetry.mSpeed, onRight);
    };

    showRpm = (onRight) => {
      this.tmBtLed.setRpm(this.telemetry.mEngineRPM, onRight);
    };
    showFuel = (onRight) => {
      this.tmBtLed.setFloat(this.telemetry.mFuel, onRight);
    };
    showTyreTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.telemetry.mTireTemp - 273.15, onRight);
    };

    showTyrePress = (onRight) => {
      this.tmBtLed.setFloat(this.telemetry.mPressure / 100, onRight);
    };

    showBrakeTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.telemetry.mBrakeTemp - 273.15, onRight);
    };
    showOilTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.telemetry.mEngineOilTemp, onRight);
    };    

    showCurrentLap = (onRight) => {
      this.tmBtLed.setTime((this.scoring.mCurrentET - this.telemetry.mLapStartET) * 1000, onRight);
    };
    showLastLap = (onRight) => {
      this.tmBtLed.setTime((this.scoring.mLastLapTime < 0 ? 0 : this.scoring.mLastLapTime) * 1000, onRight);
    };
    showBestLap = (onRight) => {
      this.tmBtLed.setTime((this.scoring.mBestLapTime < 0 ? 0 : this.scoring.mBestLapTime) * 1000, onRight);
    };
    showPosition = (onRight) => {
      this.tmBtLed.setInt(this.scoring.mPlace, onRight);
    };
    showLapNumber = (onRight) => {
      this.tmBtLed.setInt(this.telemetry.mLapNumber, onRight);
    };
    showLapsLeft = (onRight) => {
      this.tmBtLed.setInt(this.scoring.mTotalLaps - this.telemetry.mLapNumber, onRight);
    };    
}

module.exports = rF2;
