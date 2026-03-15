/*
 * Game client for Assetto Corsa (UDP version)
 * Uses ac-remote-telemetry-client for pure JavaScript UDP telemetry
 *
 * Created Date: Sunday, March 15th 2026
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021-2026 Markus Plutka
 */

const { ACRemoteTelemetryClient } = require('ac-remote-telemetry-client');
const AbstractClient = require('../lib/abstractClient.js');
const path = require('path');

const loadableConfigName = "assetto.config.js";
const defaultConfig = {
  leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP"],
  rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"],
  udpPort: 9996,
  udpHost: "127.0.0.1"
};

class AssettoUDP extends AbstractClient {
    maxRpm = 0;
    client = null;
    connected = false;

    config;
    modeMapping;

    carInfo = null;
    lapInfo = null;
    handshakeResponse = null;

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

        "LAPTIME": this.showCurrentLap,
        "LAST LAP": this.showLastLap,
        "BEST LAP": this.showBestLap,
        "POSITION": this.showPosition,
        "LAP": this.showLapNumber
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
    }

    startClient = () => {
        console.log("Starting Assetto Corsa UDP client...");
        console.log(`Connecting to ${this.config.udpHost || defaultConfig.udpHost}:${this.config.udpPort || defaultConfig.udpPort}`);
        
        this.client = new ACRemoteTelemetryClient({
            port: this.config.udpPort || defaultConfig.udpPort,
            host: this.config.udpHost || defaultConfig.udpHost
        });

        this.client.on('HANDSHAKER_RESPONSE', (data) => {
            console.log("Connected to Assetto Corsa");
            this.handshakeResponse = data;
            this.maxRpm = data.maxRpm || 8000;
            this.connected = true;
            
            this.client.subscribeUpdate();
            this.client.subscribeSpot();
        });

        this.client.on('RT_CAR_INFO', (data) => {
            this.carInfo = data;
            this.updateDisplay();
        });

        this.client.on('RT_LAP', (data) => {
            this.lapInfo = data;
        });

        this.client.on('error', (err) => {
            console.error("UDP Error:", err.message);
        });

        this.client.start();
        this.client.handshake();
    }

    stopClient = () => {
        console.log("Stopping Assetto Corsa UDP client");
        if (this.client) {
            this.client.stop();
            this.client = null;
        }
        this.connected = false;
        this.carInfo = null;
        this.lapInfo = null;
    }

    updateDisplay = () => {
        if (!this.carInfo) return;

        this.tmBtLed.setGear(this.carInfo.gear - 1);

        this.handleRevLights();

        if (this.carInfo.engineRPM > 0) {
          this.tmBtLed.setGearDot(true);
        } else {
          this.tmBtLed.setGearDot(false);
        }

        if (this.currentLeftMode <= this.leftModes.length) {
          const leftDataProcessor = this.modeMapping[this.leftModes[this.currentLeftMode]];
          if (typeof leftDataProcessor === "function") {
              leftDataProcessor(false);
          }
        }

        if (this.currentRightMode <= this.rightModes.length) {
            const rightDataProcessor = this.modeMapping[this.rightModes[this.currentRightMode]];
            if (typeof rightDataProcessor === "function") {
                rightDataProcessor(true);
            }
        }
    };

    handleRevLights() {
      if (!this.carInfo) return;
      
      const maxRpm = this.maxRpm || 8000;
      let rpmPercent = (this.carInfo.engineRPM / maxRpm) * 100;

      if (this.config.flashAllLedsAtMaxRpm && rpmPercent >= 98) {
        this.tmBtLed.setRevLightsFlashing(2);
      } else {
        this.tmBtLed.setRevLightsFlashing(0);
      }
  
      if (this.tmBtLed.revLightsFlashing === 0) {
        switch (true) {
          case this.config.blueRevLightsIndicateShift:
            this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);
  
            if (rpmPercent >= 99) {
              this.tmBtLed.setRevLightsBlueFlashing(1);
            } else {
              this.tmBtLed.setRevLightsBlueFlashing(0);
            }
            break;
          case this.config.flashingRevLightsIndicateShift:
            if (rpmPercent <= 90) {
              this.tmBtLed.setRevLights(rpmPercent);
              if (this.tmBtLed.revLightsBlueFlashing) 
                this.tmBtLed.setRevLightsBlueFlashing(0);
              return;
            }
  
            this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);
            this.tmBtLed.setRevLightsBlueFlashing(1);
            break;
          default:
            rpmPercent = rpmPercent < 50 ? 0 : ((rpmPercent - 50) / 50) * 100;
            this.tmBtLed.setRevLights(rpmPercent >= 98 ? 100 : rpmPercent);
            break;
        }
      }
    }

    showSpeed = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setSpeed(this.carInfo.speed_Kmh, onRight);
    };

    showRpm = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setRpm(this.carInfo.engineRPM, onRight);
    };

    showFuel = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setWeight(this.carInfo.fuel, onRight);
    };

    showTyreTemp = (onRight) => {
      if (!this.carInfo) return;
      const avgTemp = (
        this.carInfo.tyreTemp_FL + 
        this.carInfo.tyreTemp_FR + 
        this.carInfo.tyreTemp_RL + 
        this.carInfo.tyreTemp_RR
      ) / 4;
      this.tmBtLed.setTemperature(avgTemp, onRight);
    };

    showCurrentLap = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setTime(this.carInfo.currentLapTime, onRight);
    };

    showLastLap = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setTime(this.carInfo.lastLapTime, onRight);
    };

    showBestLap = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setTime(this.carInfo.bestLapTime, onRight);
    };

    showPosition = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setInt(this.carInfo.carPosition, onRight);
    };

    showLapNumber = (onRight) => {
      if (!this.carInfo) return;
      this.tmBtLed.setInt(this.carInfo.lapCount, onRight);
    };
}

module.exports = AssettoUDP;
