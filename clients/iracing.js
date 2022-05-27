/*
 * Game client for iRacing
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const irsdk = require('node-irsdk');
const AbstractClient = require('../lib/abstractClient.js');
const path = require('path');

const loadableConfigName = "iracing.config.js";
const defaultConfig = {
  leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "OILTEMP", "WATERTEMP"],
  rightModes: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};

class iRacing extends AbstractClient {
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
          "OILTEMP": this.showOilTemp,
          "WATERTEMP": this.showWaterTemp,

          "LAPTIME": this.showCurrentLap,
          "DELTA": this.showDelta,
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
            const rpmPercent = Math.ceil(telemetry.RPM / maxRpm * 100);
            if (this.config?.blueRevLightsIndicateShift) {
              this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);

              if (rpmPercent >= 99) {
                this.tmBtLed.setRevLightsBlueFlashing(true);
              } else {
                this.tmBtLed.setRevLightsBlueFlashing(false);
              }
            } else {
              this.tmBtLed.setRevLights(rpmPercent);
            }
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

          // Set left display according to left modes array and currentLeftMode array index
          if (this.currentLeftMode <= this.leftModes.length) {
            const leftDataProcessor = this.modeMapping[this.leftModes[this.currentLeftMode]];
            if (typeof leftDataProcessor === "function") {
                leftDataProcessor(telemetry, false);
            }
          }

          // Set right display according to right modes array and currentRightMode array index
          // Second boolean parameter (true) in setter displays value in right display
          if (this.currentRightMode <= this.rightModes.length) {
              const rightDataProcessor = this.modeMapping[this.rightModes[this.currentRightMode]];
              if (typeof rightDataProcessor === "function") {
                  rightDataProcessor(telemetry, true);
              }
          }
        });
        
        this.client.on('SessionInfo', function (data) {
          const session = data.data;
          if (this.config?.blueRevLightsIndicateShift && session.DriverInfo.DriverCarSLShiftRPM > 0) {
            maxRpm = session.DriverInfo.DriverCarSLShiftRPM;
          } else if (session.DriverInfo.DriverCarRedLine > 0) {
            maxRpm = session.DriverInfo.DriverCarRedLine;
          }
        })
    }

    showSpeed = (telemetry, onRight) => {
      this.tmBtLed.setSpeed(telemetry.Speed * 3.6, onRight);
    };

    showRpm = (telemetry, onRight) => {
      this.tmBtLed.setRpm(telemetry.RPM, onRight);
    };

    showFuel = (telemetry, onRight) => {
      this.tmBtLed.setWeight(telemetry.FuelLevel, onRight);
    };

    showTyreTemp = (telemetry, onRight) => {
      if (!telemetry.RFtempCM) {
        this.tmBtLed.setTemperature(0, onRight);  
      } else {
        let temps = telemetry.LFtempCM + telemetry.RFtempCM + telemetry.LRtempCM + telemetry.RRtempCM;
        let temp = temps / 4;
        this.tmBtLed.setTemperature(temp, onRight);
      }
    };

    showOilTemp = (telemetry, onRight) => {
      this.tmBtLed.setTemperature(telemetry.OilTemp, onRight);
    };

    showWaterTemp = (telemetry, onRight) => {
      this.tmBtLed.setTemperature(telemetry.WaterTemp, onRight);
    };

    showCurrentLap = (telemetry, onRight) => {
      this.tmBtLed.setTime(telemetry.LapCurrentLapTime * 1000, onRight);
    };

    showDelta = (telemetry, onRight) => {
      this.tmBtLed.setDiffTime(telemetry.LapDeltaToBestLap * 1000, onRight);
    };

    showLastLap = (telemetry, onRight) => {
      this.tmBtLed.setTime(telemetry.LapLastLapTime < 0 ? 0 : telemetry.LapLastLapTime * 1000, onRight);
    };

    showBestLap = (telemetry, onRight) => {
      this.tmBtLed.setTime(telemetry.LapBestLapTime * 1000, onRight);
    };

    showPosition = (telemetry, onRight) => {
      this.tmBtLed.setInt(telemetry.PlayerCarPosition, onRight);
    };

    showLapNumber = (telemetry, onRight) => {
      this.tmBtLed.setInt(telemetry.Lap, onRight);
    };

    showLapsLeft = (telemetry, onRight) => {
      this.tmBtLed.setInt(telemetry.SessionLapsRemain > 9999 ? 0 : telemetry.SessionLapsRemain, onRight);
    };



}

module.exports = iRacing;