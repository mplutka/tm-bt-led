/*
 * Game client for rFactor2
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { rF2SharedMemory } from "../lib/rF2SharedMemory.js";
import AbstractClient from '../lib/abstractClient.mjs';

const leftModes = ["SPEED", "RPM", "FUEL", "TYRETEMP", "TYREPRESS", "BRAKETEMP", "OILTEMP"];
const rightModes = ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"];

class rF2 extends AbstractClient {
    scoring = {};
    telemetry = {};
    refreshInterval = null;

    constructor(tmBtLed) {
      if (!tmBtLed) {
          throw "No TM BT Led lib found.";
      }

      super(tmBtLed);    

      this.setCallbacks({
          onLeftPreviousMode: this.leftPreviousMode,
          onLeftNextMode: this.leftNextMode,
          onRightPreviousMode: this.rightPreviousMode,
          onRightNextMode: this.rightNextMode
      });
      this.setModes(leftModes, rightModes);

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

        this.rightModes = rightModes;

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
          case 6:
            this.tmBtLed.setFlashingYellow(true);
            break                                   
          default:
            if (this.tmBtLed.isFlashingYellow) {
              this.tmBtLed.setFlashingYellow(false);
            }
            if (this.tmBtLed.isFlashingRed) {
              this.tmBtLed.setFlashingRed(false);
            }
            break;
        }


        console.log(this.telemetry, this.scoring);

        switch (this.currentLeftMode) {
          default:
          case 0:
            this.tmBtLed.setSpeed(this.telemetry.mSpeed, false);
            break;          
          case 1:
            this.tmBtLed.setRpm(this.telemetry.mEngineRPM, false);
            break;
          case 2:
            this.tmBtLed.setFloat(this.telemetry.mFuel, false);
            break;
          case 3:
            this.tmBtLed.setTemperature(this.telemetry.mTireTemp - 273.15, false);
            break;  
          case 4:
            this.tmBtLed.setFloat(this.telemetry.mPressure, false);
            break;                   
          case 5:
            this.tmBtLed.setTemperature(this.telemetry.mBrakeTemp - 273.15, false);
            break;
          case 6:
            this.tmBtLed.setTemperature(this.telemetry.mEngineOilTemp, false);
            break;
        }

        switch (this.currentRightMode) {        
          default:
          case 0:
            this.tmBtLed.setTime((this.telemetry.mElapsedTime - this.scoring.mCurrentET) * 1000, true);
            break;      
          case 1:
            this.tmBtLed.setDiffTime(this.telemetry.mDeltaTime * 1000 * 1000, true);
            break;     
          case 2:
            this.tmBtLed.setTime(this.scoring.mLastLapTime * 1000, true);
            break; 
          case 3:
            this.tmBtLed.setTime(this.scoring.mBestLapTime * 1000, true);
            break;   
          case 4:
            this.tmBtLed.setInt(this.scoring.mPlace, true);
            break;
          case 5:
            this.tmBtLed.setInt(this.telemetry.mLapNumber, true);
            break;          
          case 6:
            this.tmBtLed.setInt(this.scoring.mMaxLaps - this.telemetry.mLapNumber, true);
            break;
        }
       
    };
}

export default rF2;
