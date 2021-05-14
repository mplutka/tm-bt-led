/*
 * Game client for Raceroom
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { r3e } from "../lib/raceroom.js";
import AbstractClient from '../lib/abstractClient.mjs';

const leftModes = ["SPEED", "RPM", "FUEL", "TYRETEMP", "TYREPRESS", "BRAKETEMP", "OILTEMP"];
const rightModes = ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"];

class Raceroom extends AbstractClient {
    data = {};
    data = {};
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

      r3e.initMaps();
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
        r3e.cleanup();
    }

    updateValues = () => {

        const data = r3e.getData();
        
        if (data && Object.keys(data).length) {
          this.data = data;
        }

        this.rightModes = rightModes;

        this.tmBtLed.setGear(this.data.gear);

        // RevLights & PitLimiter
        if (this.data.pit_limiter === 1) {
          this.tmBtLed.setRevLightsFlashing(1);
        } else {
          this.tmBtLed.setRevLightsFlashing(0);
        }
        
        if (this.tmBtLed.revLightsFlashing !== 1) {
          let rpmPercent = this.data.engine_rpm / this.data.max_engine_rpm * 100;
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
        if (this.data.yellowFlag > 0) {
          this.tmBtLed.setFlashingYellow(true);
        } else {
          if (this.tmBtLed.isFlashingYellow) {
            this.tmBtLed.setFlashingYellow(false);
          }
        }

        if (this.data.blueFlag > 0) {
          this.tmBtLed.setFlashingBlue(true);
        } else {
          if (this.tmBtLed.isFlashingBlue) {
            this.tmBtLed.setFlashingBlue(false);
          }
        }

        if (this.data.blackFlag > 0 || this.data.blackWhiteFlag) {
          this.tmBtLed.setFlashingRed(true);
        } else {
          if (this.tmBtLed.isFlashingRed) {
            this.tmBtLed.setFlashingRed(false);
          }
        }        

        switch (this.currentLeftMode) {
          default:
          case 0:
            this.tmBtLed.setSpeed(this.data.car_speed, false);
            break;          
          case 1:
            this.tmBtLed.setRpm(this.data.engine_rpm, false);
            break;
          case 2:
            this.tmBtLed.setFloat(this.data.fuel_left, false);
            break;
          case 3:
            this.tmBtLed.setTemperature(this.data.tireTemp, false);
            break;  
          case 4:
            this.tmBtLed.setFloat(this.data.tirePress / 100, false);
            break;                   
          case 5:
            this.tmBtLed.setTemperature(this.data.brakeTemp, false);
            break;
          case 6:
            this.tmBtLed.setTemperature(this.data.engine_oil_temp, false);
            break;
        }

        switch (this.currentRightMode) {        
          default:
          case 0:
            this.tmBtLed.setTime(this.data.lap_time_current_self < 0 ? 0 : this.data.lap_time_current_self * 1000, true);
            break;      
          case 1:
            this.tmBtLed.setDiffTime(this.data.time_delta_best_self * 1000 * 1000, true);
            break;
          case 2:
            this.tmBtLed.setTime((this.data.lap_time_previous_self < 0 ? 0 : this.data.lap_time_previous_self) * 1000, true);
            break; 
          case 3:
            this.tmBtLed.setTime((this.data.lap_time_best_self < 0 ? 0 : this.data.lap_time_best_self) * 1000, true);
            break;   
          case 4:
            this.tmBtLed.setInt(this.data.position, true);
            break;
          case 5:
            this.tmBtLed.setInt(this.data.completed_laps + 1, true);
            break;          
          case 6:
            this.tmBtLed.setInt(this.data.number_of_laps < 0 ? 0 : (this.data.number_of_laps - this.data.completed_laps), true);
            break;
        }
       
    };
}

export default Raceroom;
