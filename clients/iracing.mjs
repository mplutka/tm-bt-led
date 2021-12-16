/*
 * Game client for iRacing
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import irsdk from 'node-irsdk';
import AbstractClient from '../src/abstractClient.mjs';

const leftModes = ["SPEED", "RPM", "FUEL", "TYRETEMP", "OILTEMP", "WATERTEMP"];
const rightModes = ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"];

class iRacing extends AbstractClient {

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

        irsdk.init({
          telemetryUpdateInterval: 1000 / 60,
          sessionInfoUpdateInterval: 10
        });
          
        this.client = irsdk.getInstance();
        this.startClient();
    }

    startClient = () =>  {          
        let maxRpm = 7500;
        
        this.client.on('Telemetry', data => {

          const telemetry = data.values;

          this.tmBtLed.setGear(telemetry.Gear);

          if (telemetry.EngineWarnings.includes('PitSpeedLimiter')) {
            this.tmBtLed.setRevLightsFlashing(1);
          } else {
            this.tmBtLed.setRevLightsFlashing(0);
          }
          if (this.tmBtLed.revLightsFlashing !== 1) { // No override because of pit limiter
            this.tmBtLed.setRevLights(Math.ceil(telemetry.RPM / maxRpm * 100));
          }
          
          if(telemetry.SessionFlags.includes('Yellow')) {
            this.tmBtLed.setFlashingYellow(true);
          } else {
            this.tmBtLed.setFlashingYellow(false);
          }

          if(telemetry.SessionFlags.includes('Red')) {
            this.tmBtLed.setFlashingRed(true);
          } else {
            this.tmBtLed.setFlashingRed(false);
          }
          
          if(telemetry.SessionFlags.includes('Blue')) {
            this.tmBtLed.setFlashingBlue(true);
          } else {
            this.tmBtLed.setFlashingBlue(false);
          }

          switch (this.currentLeftMode) {
            default:
            case 0:
              this.tmBtLed.setSpeed(telemetry.Speed * 3.6, false);
              break;      
            case 1:
              this.tmBtLed.setRpm(telemetry.RPM, false);
              break;                        
            case 2:
              this.tmBtLed.setWeight(telemetry.FuelLevel, false);
              break;
            case 3:
              if (!telemetry.RFtempCM) {
                this.tmBtLed.setTemperature(0, false);  
              } else {
                let temps = telemetry.LFtempCM + telemetry.RFtempCM + telemetry.LRtempCM + telemetry.RRtempCM;
                let temp = temps / 4;
                this.tmBtLed.setTemperature(temp, false);
              }
              break;               
            case 4:
              this.tmBtLed.setTemperature(telemetry.OilTemp, false);
              break;               
            case 5:
              this.tmBtLed.setTemperature(telemetry.WaterTemp, false);
              break;                                                                                   
          }

          switch (this.currentRightMode) {       
            default:
            case 0:
              this.tmBtLed.setTime(telemetry.LapCurrentLapTime * 1000, true);
              break;
            case 1:
              this.tmBtLed.setDiffTime(telemetry.LapDeltaToBestLap * 1000, true);
              break;  
            case 2:
              this.tmBtLed.setTime(telemetry.LapLastLapTime < 0 ? 0 : telemetry.LapLastLapTime * 1000, true);
              break;                   
            case 3:
              this.tmBtLed.setTime(telemetry.LapBestLapTime * 1000, true);
              break;          
            case 4:
              this.tmBtLed.setInt(telemetry.PlayerCarPosition, true);
              break;
            case 5:
              this.tmBtLed.setInt(telemetry.Lap, true);
              break;                
            case 6:
              this.tmBtLed.setInt(telemetry.SessionLapsRemain > 9999 ? 0 : telemetry.SessionLapsRemain, true);
              break; 
          }     

        });
        
        this.client.on('SessionInfo', function (data) {
          const session = data.data;
          if (session.DriverInfo.DriverCarSLBlinkRPM > 0) {
            maxRpm = session.DriverInfo.DriverCarSLBlinkRPM;
          }
        })

    }
}

export default iRacing;