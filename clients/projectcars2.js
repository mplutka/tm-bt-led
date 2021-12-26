/*
 * Game client for Project Cars 2 & Automobilista 2
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const AbstractClient = require('../lib/abstractClient.js');
const UdpListener = require('../lib/udpListener.js');
const UdpParser = require('../lib/pcars2-udp/udp-parser.js');
const path = require('path');

const loadableConfigName = "pcars2.config.js";
const defaultConfig = {
  leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "OILTEMP"],
  rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};

class ProjectCars2 extends AbstractClient {
    parser;
    numLaps = 0;
    localIndex = null;
    lastLap = 0;
    bestLap = 0;

    config;
    modeMapping;

    telemetry;
    timings;

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
            "BRAKETEMP": this.showBrakeTemp,
            "OILTEMP": this.showOilTemp,

            "LAPTIME": this.showCurrentLap,
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

        this.parser = new UdpParser(path.join(__dirname, '../lib/pcars2-udp/SMS_UDP_Definitions.hpp'));

        this.client = new UdpListener({ port: this.parser.port(), bigintEnabled: true });
        this.client.on("data", this.parser.pushBuffer.bind(this.parser));
    }

    startClient = () =>  {
        this.client.start();

        this.parser.on("sTelemetryData_raw", this.parseTelemetryData);
        this.parser.on("sTimingsData_raw", this.parseTimeData);
        this.parser.on("sTimeStatsData_raw", this.parseTimingsStatsData);
        this.parser.on("sRaceData_raw", this.parseRaceData);
    }

    stopClient = () => {
        this.client.stop();
    }

    parseTelemetryData = (telemetry) => {
        this.telemetry = telemetry;
        const gear = this.telemetry.sGearNumGears & 15;
        this.tmBtLed.setGear(gear === 15 ? -1 : gear);

        // Set RevLights as percentage
        let rpmPercent = this.telemetry.sRpm / this.telemetry.sMaxRpm * 100;
        if (rpmPercent < 60) {
            rpmPercent = 0;
        } else {
            rpmPercent = (rpmPercent - 60) / 40 * 100; 
        }
        this.tmBtLed.setRevLights(rpmPercent);

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
    }

    parseTimingsStatsData = (timeStatsData) => {
        if (this.localIndex === null) {
            this.lastLap = 0;
            this.bestLap = 0;
            return;
        }

        const timingStats = timeStatsData.sStats.sParticipants[this.localIndex];
        this.lastLap = timingStats.sLastLapTime >= 0 ? timingStats.sLastLapTime * 1000 : 0;
        this.bestLap = timingStats.sFastestLapTime >= 0 ? timingStats.sFastestLapTime * 1000 : 0;
    }

    parseRaceData = (raceData) => {
        if (raceData.sLapsTimeInEvent > 0) {
            this.numLaps = raceData.sLapsTimeInEvent;
        } else {
            this.numLaps = 0;
        }
    }     

    parseTimeData = (participantsData) => {
        this.localIndex = participantsData.sLocalParticipantIndex;
        this.timings = participantsData.sPartcipants[this.localIndex];

        switch (this.timings.sHighestFlag) {
            case 0:
            case 1:
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
                break;
            case 2:
                this.tmBtLed.setFlashingBlue(true);
                if (this.tmBtLed.isFlashingYellow) {
                    this.tmBtLed.setFlashingYellow(false);
                }
                if (this.tmBtLed.isFlashingRed) {
                    this.tmBtLed.setFlashingRed(false);
                }
                break;
            case 16:
                this.tmBtLed.setFlashingRed(true);
                if (this.tmBtLed.isFlashingYellow) {
                    this.tmBtLed.setFlashingYellow(false);
                }
                if (this.tmBtLed.isFlashingBlue) {
                    this.tmBtLed.setFlashingBlue(false);
                }                
                break;                
            case 32:
            case 64:
                this.tmBtLed.setFlashingYellow(true);
                if (this.tmBtLed.isFlashingRed) {
                    this.tmBtLed.setFlashingRed(false);
                }
                if (this.tmBtLed.isFlashingBlue) {
                    this.tmBtLed.setFlashingBlue(false);
                }                
                break;                
        }
    }  
    
    showSpeed = (onRight) => {
        if (!this.telemetry) {
            return;
        }
        this.tmBtLed.setSpeed(this.telemetry.sSpeed * 3.6, onRight);
    };

    showRpm = (onRight) => {
        if (!this.telemetry) {
            return;
        }
        this.tmBtLed.setRpm(this.telemetry.sRpm, onRight);
    };
    showFuel = (onRight) => {
        if (!this.telemetry) {
            return;
        }
        this.tmBtLed.setFloat(this.telemetry.sFuelLevel * this.telemetry.sFuelCapacity, onRight);
    };
    showTyreTemp = (onRight) => {
        if (!this.telemetry) {
            return;
        }
        const tyreTemps = this.telemetry.sTyreTemp[0] + this.telemetry.sTyreTemp[1] + this.telemetry.sTyreTemp[2] + this.telemetry.sTyreTemp[3];
        this.tmBtLed.setTemperature(tyreTemps / 4, onRight);
    };
    showBrakeTemp = (onRight) => {
        if (!this.telemetry) {
            return;
        }
        const brakeTemps = this.telemetry.sBrakeTempCelsius[0] + this.telemetry.sBrakeTempCelsius[1] + this.telemetry.sBrakeTempCelsius[2] + this.telemetry.sBrakeTempCelsius[3];
        this.tmBtLed.setTemperature(brakeTemps / 4, onRight);
    };
    showOilTemp = (onRight) => {
        if (!this.telemetry) {
            return;
        }
        this.tmBtLed.setTemperature(this.telemetry.sOilTempCelsius, onRight);
    };    
    showCurrentLap = (onRight) => {
        if (!this.timings) {
            return;
        }
        this.tmBtLed.setTime(this.timings.sCurrentTime >= 0 ? this.timings.sCurrentTime * 1000 : 0, onRight);
    };
    showLastLap = (onRight) => {
        this.tmBtLed.setTime(this.lastLap, onRight);
    };
    showBestLap = (onRight) => {
        this.tmBtLed.setTime(this.bestLap, onRight);
    };
    showPosition = (onRight) => {
        if (!this.timings) {
            return;
        }
        this.tmBtLed.setInt(this.timings.sRacePosition % 128, onRight);
    };
    showLapNumber = (onRight) => {
        if (!this.timings) {
            return;
        }
        this.tmBtLed.setInt(this.timings.sCurrentLap, onRight);
    };
    showLapsLeft = (onRight) => {
        if (!this.timings) {
            return;
        }
        this.tmBtLed.setInt(this.numLaps > 0 ? this.numLaps - this.timings.sCurrentLap : 0, onRight);
    };
}

module.exports = ProjectCars2;