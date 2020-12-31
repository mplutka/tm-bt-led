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

//catches ctrl+c event
process.on('SIGINT', exitHandler);

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler);
process.on('SIGUSR2', exitHandler);

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
        label: "VEL"
      },
      'rpm': {
        label: "RPM"
      },
      /*'watT': {
        label: "WATT"
      },*/
      'tyrT': {
        label: "TYRT"
      }
    }

    static rightModes = {
      'delta': {
        label: "DELTA"
      },
      'pos': {
        label: "POS"
      },
      'lapCount': {
        label: "LAP"
      },
      'lapsLeft': {
        label: "LEFT"
      },
      'curLapTime': {
        label: "TIME"
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
        this.currentRightMode = Object.keys(ACC.leftModes)[0];
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
        console.log("init client");
        setInterval(() => {
            this.updateValues();
        }, 40);
    }

    updateValues = () => {

      const physics =  AssettoCorsaSharedMemory.getPhysics();
      const graphics =  AssettoCorsaSharedMemory.getGraphics();
      const statics =  AssettoCorsaSharedMemory.getStatics();

      const rpmPercent = physics.rpms / statics.maxRpm * 100;

      this.tmBtLed.setRevLights(rpmPercent > 98 ? 100 : rpmPercent);

      this.tmBtLed.setGear(physics.gear - 1);

      switch (this.currentLeftMode) {
        case "curFuel":
          this.tmBtLed.setInt(physics.fuel, false);
          break;
        case "speed":
          this.tmBtLed.setInt(physics.speedKmh, false);
          break;
        case "rpm":
          this.tmBtLed.setRpm(physics.rpms, false);
          break;  
        /*case "watT":
          this.tmBtLed.setTemperature(physics.waterTemp, false);
          break; */
        case "tyrT":
          this.tmBtLed.setTemperature(physics.tyreCoreTemperature, false);
          break;
      }

      switch (this.currentRightMode) {
        case "delta":
          this.tmBtLed.setTime(graphics.iDeltaLapTime / 1000, true);
          break;        
        case "pos":
          this.tmBtLed.setInt(graphics.position, true);
          break;
        case "lapCount":
          this.tmBtLed.setInt(graphics.completedLaps, true);
          break;
        default:
        case "lapsLeft":
          this.tmBtLed.setInt(graphics.numberOfLaps - graphics.completedLaps, true);
          break;               
        case "curLapTime":
          this.tmBtLed.setTime(graphics.iCurrentTime / 1000, true);
          break;                    
      }          
    };
}

const acc = new ACC();
