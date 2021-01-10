/*
 * Filename: acc.mjs
 * Created Date: Tuesday, December 29th 2020, 4:15:19 am
 * Author: Markus Plutka
 * 
 * Copyright (c) 2020 Markus Plutka
 */

import AssettoCorsaSharedMemory from "./AssettoCorsaSharedMemory/index.js";
import TmBTLed from './tm_bt_led.mjs';

function exitHandler(message, exitCode) {
  AssettoCorsaSharedMemory.cleanup();
  if (message) {
    console.error(message);
  }
  console.log("Cleaning up");
}

//do something when app is closing
process.on('exit', exitHandler);
//catches uncaught exceptions
process.on('uncaughtException', exitHandler); 

class ACC {
    client;

    maxRpm = 0;

    static leftModes = {
      'curFuel': {
        label: "FUEL"
      },
      'speed': {
        label: "SPD"
      },
      'rpm': {
        label: "RPM"
      },
      'watT': {
        label: "WTRT"
      },
      'tyrT': {
        label: "TYRT"
      }
    }

    static rightModes = {
      'curLapTime': {
        label: "CLAP"
      },      
      'delta': {
        label: "DELTA"
      },
      'bestLapTime': {
        label: "BLAP"
      }, 
      'lastLapTime': {
        label: "LLAP"
      },
      'predLapTime': {
        label: "PLAP"
      },      
      'pos': {
        label: "POS"
      },
      'curLap': {
        label: "LAP"
      },
      'lapsLeft': {
        label: "LEFT"
      }
    }


    currentLeftMode;
    currentRightMode;

    constructor() {
        this.tmBtLed = new TmBTLed({
          onConnect: this.onDeviceConnected,
          onLeftPreviousMode: this.leftPreviousMode,
          onLeftNextMode: this.leftNextMode,
          onRightPreviousMode: this.rightPreviousMode,
          onRightNextMode: this.rightNextMode,
        });        

        this.currentLeftMode = Object.keys(ACC.leftModes)[0];
        this.currentRightMode = Object.keys(ACC.rightModes)[0];
    }

    onDeviceConnected = () =>  {
        // to start listening:
        this.initSession();
        

        this.tmBtLed.setLeftDisplay("ASSE");
        this.tmBtLed.setRightDisplay("CORS");
    }

      leftPreviousMode = () => {
          const modeKeys = Object.keys(ACC.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) > 0 ? modeKeys.findIndex(c => c === this.currentLeftMode) - 1 : modeKeys.length - 1;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(ACC.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;
      }

      leftNextMode = () => {
          const modeKeys = Object.keys(ACC.leftModes);
          if (modeKeys.length === 0) {
            console.error("No left modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentLeftMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentLeftMode) + 1 : 0;
          this.currentLeftMode = modeKeys[newModeIndex];
          this.tmBtLed.flashLeftDisplay(ACC.leftModes[this.currentLeftMode].label);
          return this.currentLeftMode;        
      }

      rightPreviousMode = () => {
          const modeKeys = Object.keys(ACC.rightModes);
          if (modeKeys.length === 0) {
            console.error("No right modes")
            return;
          }
          const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) > 0 ? modeKeys.findIndex(c => c === this.currentRightMode) - 1 : modeKeys.length - 1;
          this.currentRightMode = modeKeys[newModeIndex];
          this.tmBtLed.flashRightDisplay(ACC.rightModes[this.currentRightMode].label);
          return this.currentRightMode;
    }

    rightNextMode = () => {
        const modeKeys = Object.keys(ACC.rightModes);
        if (modeKeys.length === 0) {
          console.error("No right modes")
          return;
        }
        const newModeIndex = modeKeys.findIndex(c => c === this.currentRightMode) < modeKeys.length - 1 ? modeKeys.findIndex(c => c === this.currentRightMode) + 1 : 0;
        this.currentRightMode = modeKeys[newModeIndex];
        this.tmBtLed.flashRightDisplay(ACC.rightModes[this.currentRightMode].label);
        return this.currentRightMode;        
    } 

    initSession = () => {    
        console.log("5. Listening for game data... GO!");
        setInterval(() => {
            this.updateValues();
        }, 20);
    }

    updateValues = () => {

      const physics =  AssettoCorsaSharedMemory.getPhysics();
      const graphics =  AssettoCorsaSharedMemory.getGraphics();
      const statics =  AssettoCorsaSharedMemory.getStatics();

      this.tmBtLed.setGear(physics.gear - 1);

      // RevLights & PitLimiter
      if (physics.pitLimiterOn === 1) {
        this.tmBtLed.setRevLightsFlashing(1);
      } else {
        this.tmBtLed.setRevLightsFlashing(0);
      }
      
      if (this.tmBtLed.revLightsFlashing !== 1) {
        let rpmPercent = physics.rpms / statics.maxRpm * 100;
        if (rpmPercent < 50) {
          rpmPercent = 0;
        } else {
          rpmPercent = (rpmPercent - 50) / 50 * 100;
        }

        this.tmBtLed.setRevLights(rpmPercent >= 98 ? 100 : rpmPercent);
      }

      if (physics.isEngineRunning === 1) {
        this.tmBtLed.setGearDot(true);
      } else {
        this.tmBtLed.setGearDot(false);
      }

      // Flags
      switch(graphics.flag) {
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

      switch (this.currentLeftMode) {
        case "curFuel":
          this.tmBtLed.setWeight(physics.fuel, false);
          break;
        case "speed":
          this.tmBtLed.setSpeed(physics.speedKmh, false);
          break;
        case "rpm":
          this.tmBtLed.setRpm(physics.rpms, false);
          break;
        case "tyrT":
          this.tmBtLed.setTemperature(physics.tyreCoreTemperature, false);
          break;  
        case "watT":
          this.tmBtLed.setTemperature(physics.waterTemp, false);
          break;
      }

      switch (this.currentRightMode) {              
        case "delta":
          this.tmBtLed.setDiffTime(graphics.iDeltaLapTime, true);
          break;      
        case "bestLapTime":
          this.tmBtLed.setTime(graphics.iBestTime, true);
          break;   
        case "lastLapTime":
          this.tmBtLed.setTime(graphics.iLastTime, true);
          break;
        case "predLapTime":
          this.tmBtLed.setTime(graphics.iEstimatedLapTime, true);
          break;                                  
        case "pos":
          this.tmBtLed.setInt(graphics.position, true);
          break;
        case "curLap":
          this.tmBtLed.setInt(graphics.completedLaps + 1, true);
          break;
        case "lapsLeft":
          this.tmBtLed.setInt(graphics.numberOfLaps < 1000 ? (graphics.numberOfLaps - graphics.completedLaps) : 0, true);
          break;          
        default:
        case "curLapTime":
          this.tmBtLed.setTime(graphics.iCurrentTime, true);
          break;
      }          
    };
}

const acc = new ACC();
