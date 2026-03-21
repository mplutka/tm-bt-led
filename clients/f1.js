/*
 * Game client for F1 20xx
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const { F1TelemetryClient, constants } = require('@racehub-io/f1-telemetry-client');
const AbstractClient = require('../lib/abstractClient.js');
const { getClientConfig } = require('../lib/configLoader.js');
const { resolveRevLightFlash } = require('../lib/revLightFlash.js');
const { PACKETS } = constants;
const dgram = require('dgram');


class F1 extends AbstractClient {
    config;
    udpServer = null;

    constructor(tmBtLed) {
        if (!tmBtLed) {
            throw "No TM BT Led lib found.";
        }

        super(tmBtLed);    

        this.config = getClientConfig('f1', 'f1.config.js');
        this.revFlashProfile = resolveRevLightFlash(this.config);
        this.tmBtLed.setRevLightFlashProfile(this.revFlashProfile);

        this.setCallbacks({
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode
        });
        this.setModes(this.config?.leftModes, this.config?.rightModes);

        const listenPort = this.config.port || 20777;
        const forwardPorts = this.config.forwardPorts || [];

        if (forwardPorts.length > 0) {
            const internalPort = this.config.internalPort || 20778;
            this.setupUdpForwarder(listenPort, internalPort, forwardPorts);
            this.client = new F1TelemetryClient({ port: internalPort, bigintEnabled: true });
        } else {
            this.client = new F1TelemetryClient({ port: listenPort, bigintEnabled: true });
        }
    }

    setupUdpForwarder(listenPort, internalPort, forwardPorts) {
        this.udpServer = dgram.createSocket('udp4');

        this.udpServer.on('error', (err) => {
            console.error(`UDP Server error:\n${err.stack}`);
            this.udpServer.close();
        });
        
        this.udpServer.on('message', (msg, rinfo) => {
            this.udpServer.send(msg, internalPort, '127.0.0.1', (err) => {
                if (err) console.error(`Error forwarding to internal port:`, err);
            });

            forwardPorts.forEach(port => {
                this.udpServer.send(msg, port, '127.0.0.1', (err) => {
                    if (err) console.error(`Error forwarding to port ${port}:`, err);
                });
            });
        });
        
        this.udpServer.on('listening', () => {
            const address = this.udpServer.address();
            console.log(`F1 UDP server listening on port ${address.port}`);
            console.log(`Forwarding to internal port ${internalPort} and additional ports: ${forwardPorts.join(', ')}`);
        });
        
        this.udpServer.bind(listenPort);
    }

    stopClient = () => {
        this.client.stop();
        if (this.udpServer) {
            this.udpServer.close();
            this.udpServer = null;
        }
    }

    startClient = () =>  {     
        let bestDeltaData = new Map();
        let currentDeltaData = new Map();
        let bestLapTime = 0; // Best Lap of current session, not of all time
        let totalLaps = 60;
        let trackLength = 0;
        let modernCar = false;
        let lapData;
        let carStatus;
        let carTelemetry;
        let delta;       

        const showSpeed = (onRight) => {
            this.tmBtLed.setSpeed(carTelemetry.m_speed, onRight);
        };
    
        const showRpm = (onRight) => {
            this.tmBtLed.setRpm(carTelemetry.m_engineRPM, onRight);
        };
    
        const showTyreTemp = (onRight) => {
            this.tmBtLed.setTemperature((carTelemetry.m_tyresSurfaceTemperature.reduce((a, b) => a + b, 0) / carTelemetry.m_tyresSurfaceTemperature.length) || 0, onRight);
        };
    
        const showBrakeTemp = (onRight) => {
            this.tmBtLed.setTemperature((carTelemetry.m_brakesTemperature.reduce((a, b) => a + b, 0) / carTelemetry.m_brakesTemperature.length) || 0, onRight);
        };
    
        const showEngineTemp = (onRight) => {
            this.tmBtLed.setTemperature(carTelemetry.m_engineTemperature, onRight);
        };
    
        const showFuel = (onRight) => {
            this.tmBtLed.setWeight(carStatus.m_fuelInTank, onRight);
        };
    
        const showErsLevel = (onRight) => {
            this.tmBtLed.setInt(carStatus.m_ersStoreEnergy, onRight);
        };
    
        const showCurrentLap = (onRight) => {
            this.tmBtLed.setTime(lapData.m_currentLapTime * 1000, onRight);
        };
    
        const showDelta = (onRight) => {
            this.tmBtLed.setDiffTime(delta !== null ? delta * 1000 : null, onRight);
        };
    
        const showLastLap = (onRight) => {
            this.tmBtLed.setTime(lapData.m_lastLapTime * 1000 , onRight);
        };
    
        const showBestLap = (onRight) => {
            this.tmBtLed.setTime(lapData.m_bestLapTime * 1000, onRight);
        };
    
        const showPosition = (onRight) => {
            this.tmBtLed.setInt(lapData.m_carPosition, onRight);
        };
    
        const showLapNumber = (onRight) => {
            this.tmBtLed.setInt(lapData.m_currentLapNum, onRight);
        };
    
        const showLapsLeft = (onRight) => {
            this.tmBtLed.setInt(totalLaps - lapData.m_currentLapNum, onRight);
        };
        
        const modeMapping = {
            "SPEED": showSpeed,
            "RPM": showRpm,
            "FUEL": showFuel,
            "TYRETEMP": showTyreTemp,
            "BRAKETEMP": showBrakeTemp,
            "ENGINETEMP": showEngineTemp,
            "ERSLEVEL": showErsLevel,
            "LAPTIME": showCurrentLap,
            "DELTA": showDelta,
            "LAST LAP": showLastLap,
            "BEST LAP": showBestLap,
            "POSITION": showPosition,
            "LAP": showLapNumber,
            "LAPS LEFT": showLapsLeft,
        };
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
            lapData = d.m_lapData[myIndex];

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

            delta = null;
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
            carStatus = d.m_carStatusData[myIndex];

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
        });

        this.client.on(PACKETS.carTelemetry, d => {
            const myIndex = d.m_header.m_playerCarIndex;
            carTelemetry = d.m_carTelemetryData[myIndex];
            this.tmBtLed.setGear(carTelemetry.m_gear);
        
            drsOn = carTelemetry.m_drs === 1;
            if (this.tmBtLed.shouldApplyClientRevLights()) {
                if (drsOn) {
                    this.tmBtLed.setRevLightsGreen(4);
                } else if (drsAvailable) {
                    this.tmBtLed.setRevLightsGreen(2);
                } else {
                    this.tmBtLed.setRevLightsGreen(0);
                }
            }
            
            if (this.tmBtLed.shouldApplyClientRevLights()) { // Pit limiter uses full-bar flash only
                if (modernCar) {
                    this.tmBtLed.setRevLightsWithoutGreen(carTelemetry.m_revLightsPercent, 25);
                } else {
                    const st = this.revFlashProfile.shift.style;
                    if (st === 'blue_late' || st === 'blue_early') {
                      this.tmBtLed.setRevLightsWithoutBlue(carTelemetry.m_revLightsPercent);
                      const th = st === 'blue_early' ? 95 : 99;
                      if (carTelemetry.m_revLightsPercent >= th) {
                        this.tmBtLed.setRevLightsBlueFlashing(true);
                      } else {
                        this.tmBtLed.setRevLightsBlueFlashing(false);
                      }
                    } else {
                      this.tmBtLed.setRevLights(carTelemetry.m_revLightsPercent);
                    }
                }
            }

            if (this.currentLeftMode <= this.leftModes.length) {
                const leftDataProcessor = modeMapping[this.leftModes[this.currentLeftMode]];
                if (typeof leftDataProcessor === "function") {
                    leftDataProcessor(false);
                }
            }

            if (this.currentRightMode <= this.rightModes.length) {
                const rightDataProcessor = modeMapping[this.rightModes[this.currentRightMode]];
                if (typeof rightDataProcessor === "function") {
                    rightDataProcessor(true);
                }
            }
        });

        this.client.start();
    };
}

module.exports = F1;