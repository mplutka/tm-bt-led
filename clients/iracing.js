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
const { getClientConfig } = require('../lib/configLoader.js');
const { resolveRevLightFlash } = require('../lib/revLightFlash.js');
const { resolveMaxRpmForRevLights } = require('../lib/resolveMaxRpm.js');

/**
 * Max RPM for the rev bar from session info: shift-light RPM when a shift style is configured,
 * otherwise the redline. iRacing reports these as numbers or strings like "7800.000".
 */
function maxRpmFromSession(session, preferShiftRpm) {
  const driverInfo = session?.DriverInfo || {};
  const shiftRpm = parseFloat(driverInfo.DriverCarSLShiftRPM);
  const redLine = parseFloat(driverInfo.DriverCarRedLine);
  if (preferShiftRpm && shiftRpm > 0) {
    return shiftRpm;
  }
  if (redLine > 0) {
    return redLine;
  }
  return shiftRpm > 0 ? shiftRpm : null;
}

class iRacing extends AbstractClient {
    config;
    modeMapping;
    sessionMaxRpm = null;
    detectedMaxRpm = 5000;

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
  
        this.config = getClientConfig('iracing', 'iracing.config.js');

        this.revFlashProfile = resolveRevLightFlash(this.config);
        this.tmBtLed.setRevLightFlashProfile(this.revFlashProfile);

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
    }

    startClient = () =>  {
        this.stopClient();
        this.client.on('Telemetry', this.onTelemetry);
        this.client.on('SessionInfo', this.onSessionInfo);
    }

    // irsdk is a process-wide singleton that cannot be restarted, so only detach our listeners.
    stopClient = () => {
        this.client.removeListener('Telemetry', this.onTelemetry);
        this.client.removeListener('SessionInfo', this.onSessionInfo);
    }

    onSessionInfo = (data) => {
        const preferShiftRpm = this.revFlashProfile.shift.style !== 'off';
        const maxRpm = maxRpmFromSession(data?.data, preferShiftRpm);
        if (maxRpm && maxRpm !== this.sessionMaxRpm) {
          console.log(`iRacing max RPM for rev lights: ${maxRpm}`);
          this.sessionMaxRpm = maxRpm;
        }
    }

    onTelemetry = (data) => this.guard(this.handleTelemetry)(data);

    handleTelemetry = (data) => {
          const telemetry = data.values;
          const maxRpm = resolveMaxRpmForRevLights(
            {
              telemetryMaxRpm: this.sessionMaxRpm,
              fallbackMaxRpm: this.config?.fallbackMaxRpm,
              currentRpm: telemetry.RPM
            },
            this
          );

          this.tmBtLed.setGear(telemetry.Gear);

          if (telemetry.EngineWarnings.includes('PitSpeedLimiter')) {
            this.tmBtLed.setRevLightsFlashing(1);
          } else {
            this.tmBtLed.setRevLightsFlashing(0);
          }
          if (this.tmBtLed.shouldApplyClientRevLights()) {
            const rpmPercent = Math.ceil(telemetry.RPM / maxRpm * 100);
            const st = this.revFlashProfile.shift.style;
            if (st === 'blue_late' || st === 'blue_early') {
              this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);
              const th = st === 'blue_early' ? 95 : 99;
              if (rpmPercent >= th) {
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
module.exports.maxRpmFromSession = maxRpmFromSession;