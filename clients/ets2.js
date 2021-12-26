/*
 * Game client for Euro Truck Simulator 2
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const scs = require("../SCSSharedMemory/build/Release/scs.node");
const AbstractClient = require('../lib/abstractClient.js');
const path = require('path');

const loadableConfigName = "ets2.config.js";
const defaultConfig = {
    leftModes: ["SPEED", "RPM", "FUEL", "WATERTEMP", "OILTEMP", "OILPRESS", "AIRPRESS", "BRAKETEMP"],
    rightModes: ["DISTANCE", "TIME", "SPEED LIMIT", "CRUISE CONT", "AVG CONSUM", "RANGE"]
};

class EuroTruckSimulator2 extends AbstractClient {
    data = {};
    data = {};
    initInterval = null;
    refreshInterval = null;
    initDone = false;

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
        "WATERTEMP": this.showWaterTemp,
        "OILTEMP": this.showOilTemp,
        "OILPRESS": this.showOilPress,
        "AIRPRESS": this.showAirPress,
        "BRAKETEMP": this.showBrakeTemp,
        "DISTANCE": this.showDistance,
        "TIME": this.showTime,
        "SPEED LIMIT": this.showSpeedLimit,
        "CRUISE CONT": this.showCruiseControl,
        "AVG CONSUM": this.showAvgConsumption,
        "RANGE": this.showRange
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

      this.initInterval = setInterval(() => {
        let initRet = scs.initMaps();
        if (initRet === 0) {
          this.initDone = true;
          console.log("Plugin loaded successfully");
          clearInterval(this.initInterval);
          this.initInterval = null;
        }
      }, 3000);
    }

    startClient = () =>  {
        this.refreshInterval = setInterval(() => {
          if (this.initDone) {
            this.updateValues();
          }
        }, 1000 / 30); // 30 Hz
    }

    stopClient = () => {
        if (this.initInterval) {
            clearInterval(this.initInterval);
            this.initInterval = null;
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
        scs.cleanup();
    }

    updateValues = () => {

        const data = scs.getData();
        
        if (data && Object.keys(data).length) {
          this.data = data;
        }

        let rpmPercent = this.data.engine_rpm / this.data.max_engine_rpm * 100;
        if (rpmPercent < 50) {
          rpmPercent = 0;
        } else {
          rpmPercent = (rpmPercent - 50) / 50 * 100;
        }

        this.tmBtLed.setRevLights(rpmPercent >= 98 ? 100 : rpmPercent);

        if (this.data.gearDashboard < 10 && this.data.gearDashboard >= 0) {
          this.tmBtLed.setGear(this.data.gearDashboard);          
          this.tmBtLed.setGearDotFlashing(0);
          this.tmBtLed.setGearDot(false);
        } else if (this.data.gearDashboard >= 10) {
          this.tmBtLed.setGear(this.data.gearDashboard == 10 ? null : this.data.gearDashboard % 10); // null == 0
          this.tmBtLed.setGearDotFlashing(0);
          this.tmBtLed.setGearDot(true);
        } else if (this.data.gearDashboard < 0) {
          this.tmBtLed.setGearDotFlashing(1);
          this.tmBtLed.setGear(Math.abs(this.data.gearDashboard));
        }

        // Left LEDs
        if (this.data.blinkerLeftOn) {
          this.tmBtLed.setLeftYellow(true);
        } else {
          this.tmBtLed.setLeftYellow(false);
        }
        const warningIndicators = ["airPressureWarning", "airPressureEmergency",
          "fuelWarning", "adblueWarning",
          "oilPressureWarning", "waterTemperatureWarning", "batteryVoltageWarning"];
        if (!warningIndicators.every(indicator => this.data[indicator])) {
          this.tmBtLed.setLeftRed(false);
        } else {
          this.tmBtLed.setLeftRed(true);
        }

        if (this.data.lightsBeamHigh) {
          this.tmBtLed.setLeftBlue(true);
        } else {
          this.tmBtLed.setLeftBlue(false);
        }

        // Right LEDs
        if (this.data.blinkerRightOn) {
          this.tmBtLed.setRightYellow(true);
        } else {
          this.tmBtLed.setRightYellow(false);
        }

        if (this.data.speedLimit > 0 && this.data.speed > this.data.speedLimit * 1.03) {
          this.tmBtLed.setRightRed(true);
        } else {
          this.tmBtLed.setRightRed(false);
        }

        if (this.data.cruiseControl) {
          this.tmBtLed.setRightBlue(true);
        } else {
          this.tmBtLed.setRightBlue(false);
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
      this.tmBtLed.setSpeed(this.data.speed * 3.6, onRight);
    }
    
    showRpm = (onRight) => {
      this.tmBtLed.setRpm(this.data.engine_rpm, onRight);
    }

    showFuel = (onRight) => {
      this.tmBtLed.setInt(this.data.fuel, onRight);
    }
    
    showWaterTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.data.waterTemperature, onRight);
    }

    showOilTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.data.oilTemperature, onRight);
    }

    showOilPress = (onRight) => {
      this.tmBtLed.setFloat(this.data.oilPressure, onRight);
    }

    showAirPress = (onRight) => {
      this.tmBtLed.setFloat(this.data.airPressure, onRight);
    }

    showBrakeTemp = (onRight) => {
      this.tmBtLed.setTemperature(this.data.brakeTemperature, onRight);
    }

    showDistance = (onRight) => {
      this.tmBtLed.setFloat(this.data.routeDistance / 1000, onRight);
    }

    showTime = (onRight) => {
      this.tmBtLed.setTime(this.data.routeTime / 60 * 1000, onRight); // in ms
    }

    showSpeedLimit = (onRight) => {
      this.tmBtLed.setSpeed(this.data.speedLimit >= 0 ? this.data.speedLimit * 3.6 : 0, onRight);
    }

    showCruiseControl = (onRight) => {
      this.tmBtLed.setSpeed(this.data.cruiseControlSpeed * 3.6, onRight);
    }

    showAvgConsumption = (onRight) => {
      this.tmBtLed.setFloat(this.data.fuelAvgConsumption, onRight);
    }

    showRange = (onRight) => {
      this.tmBtLed.setFloat(this.data.fuelRange / 1000, onRight);
    }
}

module.exports = EuroTruckSimulator2;
