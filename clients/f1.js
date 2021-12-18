/*
 * Game client for F1 20xx
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const { F1TelemetryClient, constants } = require('f1-telemetry-client');
const AbstractClient = require('../lib/abstractClient.js');
const { PACKETS } = constants;

const leftModes = ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "ENGINETEMP", "ERSLEVEL"];
const rightModes = ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"];

class F1 extends AbstractClient {
    port = 20777;       // UDP port the client should listen on for telemetry data

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

        this.client = new F1TelemetryClient({ port: this.port, bigintEnabled: true });
    }

    stopClient = () => {
        this.client.stop();
    }

    startClient = () =>  {     
        let bestDeltaData = new Map();
        let currentDeltaData = new Map();
        let bestLapTime = 0; // Best Lap of current session, not of all time
        let totalLaps = 60;
        let trackLength = 0;
        let modernCar = false;
        // https://f1-2019-telemetry.readthedocs.io/en/latest/telemetry-specification.html
        /*client.on(PACKETS.event, console.log);
        client.on(PACKETS.motion, console.log);
        client.on(PACKETS.carSetups, console.log);
        client.on(PACKETS.participants, console.log);*/

        let onThrottle = null; // Differential
        this.client.on(PACKETS.carSetups, d => {
            const myIndex = d.m_header.m_playerCarIndex;
            const carSetups = d.m_carSetups[myIndex];  

            if (carSetups.m_onThrottle !== onThrottle) {
                if (onThrottle >= 0) {
                    this.tmBtLed.showTemporary("DIFFERENTIAL", carSetups.m_onThrottle);
                }
                onThrottle = carSetups.m_onThrottle;
            }    
        });

        this.client.on(PACKETS.session, d => {
          totalLaps = d.m_totalLaps;
          trackLength = d.m_trackLength || 0;
          modernCar = d.m_formula === 0;
        });

        this.client.on(PACKETS.lapData, d => {
            this.tmBtLed.setRightTimeSpacer(false);
            const myIndex = d.m_header.m_playerCarIndex;
            const lapData = d.m_lapData[myIndex];

            // Reset on session change
            if (lapData.m_lapDistance < 0 && (bestLapTime > 0 || bestDeltaData.size > 0)) {
                bestDeltaData.clear();
                currentDeltaData.clear();
                bestLapTime = 0;
            }

            const fractionOfLap = trackLength === 0 || lapData.m_lapDistance < 0 ? 0 : (lapData.m_lapDistance / trackLength).toFixed(6);
            if (fractionOfLap >= 0.997 && currentDeltaData.size > 1000) {
                if (lapData.m_currentLapInvalid !== 1 && (lapData.m_currentLapTime <= bestLapTime || !bestLapTime)) {
                    bestDeltaData.clear();
                    bestDeltaData = new Map(currentDeltaData);
                    bestLapTime = lapData.m_currentLapTime;
                }
                currentDeltaData.clear();
            }

            let delta = null;
            if (bestDeltaData.size) {
                let bestTimeForFraction = null;
                bestDeltaData.forEach((bestTime, bestFraction) => {
                    if (!bestTimeForFraction || bestFraction <= fractionOfLap) {
                        bestTimeForFraction = bestTime;
                    }
                });

                if (bestTimeForFraction) {
                    delta = lapData.m_currentLapTime - bestTimeForFraction;
                }
            }
            currentDeltaData.set(fractionOfLap, lapData.m_currentLapTime);

            // console.log(delta, lapData.m_lapDistance, fractionOfLap, currentDeltaData.size, bestDeltaData.size, lapData.m_currentLapTime, lapData.m_lastLapTime, bestLapTime);

            switch (this.currentRightMode) {
                default:                             
                case 0:
                  this.tmBtLed.setTime(lapData.m_currentLapTime * 1000, true);
                  break;
                case 1:
                  this.tmBtLed.setDiffTime(delta !== null ? delta * 1000 : null, true);
                  break;                     
                case 2:
                  this.tmBtLed.setTime(lapData.m_lastLapTime * 1000 , true);
                  break;   
                case 3:
                  this.tmBtLed.setTime(lapData.m_bestLapTime * 1000, true);
                  break;                        
                case 4:
                  this.tmBtLed.setInt(lapData.m_carPosition, true);
                  break;               
                case 5:
                  this.tmBtLed.setInt(lapData.m_currentLapNum, true);
                  break;
                case 6:
                  this.tmBtLed.setInt(totalLaps - lapData.m_currentLapNum, true);
                  break; 
            }

            if (lapData.m_currentLapInvalid === 1) {
                this.tmBtLed.setFlashingRightRed(true);
            } else {
                this.tmBtLed.setFlashingRightRed(false);
            }
        });

        let drsOn = false;
        let drsAvailable = false;

        let ersDeployMode = null;
        const ersDeployModes = ["NONE", "LOW ","MEDIUM", "HIGH", "OVERTAKE", "HOTLAP"];

        let fuelMix = null;
        const fuelMixes = ["LEAN", "STANDARD", "RICH", "MAX"];

        let frontBrakeBias = null;

        this.client.on(PACKETS.carStatus, d => {
            const myIndex = d.m_header.m_playerCarIndex;
            const carStatus = d.m_carStatusData[myIndex];


            if (carStatus.m_ersDeployMode !== ersDeployMode) {
                if (ersDeployMode >= 0) {
                    this.tmBtLed.showTemporary("ERSMODE", ersDeployModes[carStatus.m_ersDeployMode]);
                }
                ersDeployMode = carStatus.m_ersDeployMode;
            }

            if (carStatus.m_fuelMix !== fuelMix) {
                if (fuelMix >= 0) {
                    this.tmBtLed.showTemporary("FUELMIX", fuelMixes[carStatus.m_fuelMix]);
                }
                fuelMix = carStatus.m_fuelMix;
            }

            if (carStatus.m_frontBrakeBias !== frontBrakeBias) {
                if (frontBrakeBias >= 0) {
                    this.tmBtLed.showTemporary("BRAKEBAL", carStatus.m_frontBrakeBias);
                }
                frontBrakeBias = carStatus.m_frontBrakeBias;
            }            

            drsAvailable = carStatus.m_drsAllowed === 1;

            switch(carStatus.m_vehicleFiaFlags) {
                case 2:
                    this.tmBtLed.setFlashingBlue(true);
                    break;    
                case 3:
                    this.tmBtLed.setFlashingYellow(true);
                    break;
                case 4:
                    this.tmBtLed.setFlashingRed(true);
                    break;                     
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
                    break;
            }
        
            if (carStatus.m_pitLimiterStatus === 1) {
                this.tmBtLed.setRevLightsFlashing(1);
            } else {
                this.tmBtLed.setRevLightsFlashing(0);
            }

            switch (this.currentLeftMode) {
                case 2:
                    this.tmBtLed.setWeight(carStatus.m_fuelInTank, false);
                    break;           
                case 6:
                    this.tmBtLed.setInt(carStatus.m_ersStoreEnergy, false);
                    break;                                                     
            }
        });

        this.client.on(PACKETS.carTelemetry, d => {
            const myIndex = d.m_header.m_playerCarIndex;
            const carTelemetry = d.m_carTelemetryData[myIndex];
            this.tmBtLed.setGear(carTelemetry.m_gear);
        
            drsOn = carTelemetry.m_drs === 1;
            if (!this.tmBtLed.revLightsFlashing) {
                if (drsOn) {
                    this.tmBtLed.setRevLightsGreen(4);
                } else if (drsAvailable) {
                    this.tmBtLed.setRevLightsGreen(2);
                } else {
                    this.tmBtLed.setRevLightsGreen(0);
                }
            }
            
            if (this.tmBtLed.revLightsFlashing !== 1) { // No override because of pit limiter
                if (modernCar) {
                    this.tmBtLed.setRevLightsWithoutGreen(carTelemetry.m_revLightsPercent, 25);
                } else {
                    this.tmBtLed.setRevLights(carTelemetry.m_revLightsPercent);
                }

            }

            switch (this.currentLeftMode) {
                default:
                case 0:
                  this.tmBtLed.setSpeed(carTelemetry.m_speed, false);
                  break;
                case 1:
                  this.tmBtLed.setRpm(carTelemetry.m_engineRPM, false);
                  break;  
                case 3:
                  this.tmBtLed.setTemperature((carTelemetry.m_tyresSurfaceTemperature.reduce((a, b) => a + b, 0) / carTelemetry.m_tyresSurfaceTemperature.length) || 0, false);
                  break; 
                case 4:
                  this.tmBtLed.setTemperature((carTelemetry.m_brakesTemperature.reduce((a, b) => a + b, 0) / carTelemetry.m_brakesTemperature.length) || 0, false);
                  break;                                                           
                case 5:
                  this.tmBtLed.setTemperature(carTelemetry.m_engineTemperature, false);
                  break; 
                                                                                           
            }
        });
        this.client.start();
    }
}

module.exports = F1;