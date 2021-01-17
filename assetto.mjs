/*
 * Game client for Assetto corsa series
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import AssettoCorsaSharedMemory from "./lib/assettoCorsaSharedMemory.js";
import AbstractClient from './lib/abstractClient.mjs';

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

const gameTitle = "ASSECORS";

const leftModes = ["SPD", "RPM", "FUEL", "TYRT", "BRKT"];
const rightModes = ["CLAP", "DELTA", "LLAP", "BLAP", "PLAP", "POS", "LAP", "LEFT"];

const rightModesAssetto = ["CLAP", /*"DELTA",*/ "LLAP", "BLAP", /*"PLAP",*/ "POS", "LAP", "LEFT"];


// SM Version 1.7

class ACC extends AbstractClient {
    maxRpm = 0;
    isACC = true;

    constructor(...params) {
      super(...params);    

      this.initTmBtLed({
          onConnect: this.onDeviceConnected,
          onLeftPreviousMode: this.leftPreviousMode,
          onLeftNextMode: this.leftNextMode,
          onRightPreviousMode: this.rightPreviousMode,
          onRightNextMode: this.rightNextMode,
      });
    }

    onDeviceConnected = () =>  {
        console.log("5. Listening for game data... GO!");
        setInterval(() => {
            this.updateValues();
        }, 1000 / 60); // 60 Hz
    }

    updateValues = () => {
        const physics =  AssettoCorsaSharedMemory.getPhysics();
        const statics =  AssettoCorsaSharedMemory.getStatics();

        this.isACC = !(statics.smVersion < 1.8);

        let graphics = null;
        if (this.isACC) {
          graphics = AssettoCorsaSharedMemory.getGraphicsACC();
          this.rightModes = rightModes;
        } else {
          graphics = AssettoCorsaSharedMemory.getGraphicsAssetto();
          this.rightModes = rightModesAssetto;
        }

        this.tmBtLed.setGear(physics.gear - 1);

        // RevLights & PitLimiter
        if (physics.pitLimiterOn === 1 || graphics.isInPitLane || graphics.isInPit) {
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
          default:
          case 0:
            this.tmBtLed.setSpeed(physics.speedKmh, false);
            break;          
          case 1:
            this.tmBtLed.setRpm(physics.rpms, false);
            break;
          case 2:
            this.tmBtLed.setWeight(physics.fuel, false);
            break;
          case 3:
            this.tmBtLed.setTemperature(physics.tyreCoreTemperature, false);
            break;  
          case 4:
            this.tmBtLed.setTemperature(physics.brakeTemp, false);
            break;
        }

        if (this.isACC) {
          switch (this.currentRightMode) {        
            default:
            case 0:
              this.tmBtLed.setTime(graphics.iCurrentTime, true);
              break;      
            case 1:
              this.tmBtLed.setDiffTime(graphics.iDeltaLapTime, true);
              break;     
            case 2:
              this.tmBtLed.setTime(graphics.iLastTime, true);
              break; 
            case 3:
              this.tmBtLed.setTime(graphics.iBestTime, true);
              break;   
            case 4:
              this.tmBtLed.setTime(graphics.iEstimatedLapTime, true);
              break;                                  
            case 5:
              this.tmBtLed.setInt(graphics.position, true);
              break;
            case 6:
              this.tmBtLed.setInt(graphics.completedLaps + 1, true);
              break;          
            case 7:
              this.tmBtLed.setInt(graphics.numberOfLaps < 1000 ? (graphics.numberOfLaps - graphics.completedLaps) : 0, true);
              break;
          }
        } else {
          switch (this.currentRightMode) {        
            default:
            case 0:
              this.tmBtLed.setTime(graphics.iCurrentTime, true);
              break;      
            case 1:
              this.tmBtLed.setTime(graphics.iLastTime, true);
              break; 
            case 2:
              this.tmBtLed.setTime(graphics.iBestTime, true);
              break;   
            case 3:
              this.tmBtLed.setInt(graphics.position, true);
              break;
            case 4:
              this.tmBtLed.setInt(graphics.completedLaps + 1, true);
              break;          
            case 5:
              this.tmBtLed.setInt(graphics.numberOfLaps < 1000 ? (graphics.numberOfLaps - graphics.completedLaps) : 0, true);
              break;
          }   
        }
       
    };
}

const acc = new ACC(gameTitle, leftModes, rightModes);
