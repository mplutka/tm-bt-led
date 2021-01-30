/*
 * Game client for F1 20xx
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { F1TelemetryClient, constants } from 'f1-telemetry-client';
import AbstractClient from '../lib/abstractClient.mjs';
const { PACKETS } = constants;


const leftModes = ["SPD", "RPM", "FUEL", "TYRT", "BRKT", "ENGT", "ERS"];
const rightModes = ["CLAP", "LLAP", "BLAP", "POS", "LAP", "LEFT"];

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
        let totalLaps = 60;
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
                    this.tmBtLed.showTemporaryMessage("DIFF" + carSetups.m_onThrottle);
                }
                onThrottle = carSetups.m_onThrottle;
            }    
        });

        this.client.on(PACKETS.session, d => {
          totalLaps = d.m_totalLaps;
        });

        this.client.on(PACKETS.lapData, d => {
            this.tmBtLed.setRightTimeSpacer(false);
            const myIndex = d.m_header.m_playerCarIndex;
            const lapData = d.m_lapData[myIndex];      

            switch (this.currentRightMode) {
                default:                             
                case 0:
                  this.tmBtLed.setTime(lapData.m_currentLapTime * 1000, true);
                  break;
                case 1:
                  this.tmBtLed.setTime(lapData.m_lastLapTime * 1000 , true);
                  break;   
                case 2:
                  this.tmBtLed.setTime(lapData.m_bestLapTime * 1000, true);
                  break;                        
                case 3:
                  this.tmBtLed.setInt(lapData.m_carPosition, true);
                  break;               
                case 4:
                  this.tmBtLed.setInt(lapData.m_currentLapNum, true);
                  break;
                case 5:
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

        let ersDeployMode = null;
        const ersDeployModes = ["None","LOW ","MEDI", "HIGH", "OVRT", "HOTL"];

        let fuelMix = null;
        const fuelMixes = ["LEAN", "STND", "RICH", "MAX"];

        let frontBrakeBias = null;

        this.client.on(PACKETS.carStatus, d => {
            const myIndex = d.m_header.m_playerCarIndex;
            const carStatus = d.m_carStatusData[myIndex];


            if (carStatus.m_ersDeployMode !== ersDeployMode) {
                if (ersDeployMode >= 0) {
                    this.tmBtLed.showTemporaryMessage(" ERS" + ersDeployModes[carStatus.m_ersDeployMode]);
                }
                ersDeployMode = carStatus.m_ersDeployMode;
            }

            if (carStatus.m_fuelMix !== fuelMix) {
                if (fuelMix >= 0) {
                    this.tmBtLed.showTemporaryMessage("FLMX" + fuelMixes[carStatus.m_fuelMix]);
                }
                fuelMix = carStatus.m_fuelMix;
            }

            if (carStatus.m_frontBrakeBias !== frontBrakeBias) {
                if (frontBrakeBias >= 0) {
                    this.tmBtLed.showTemporaryMessage("BRKB" + carStatus.m_frontBrakeBias);
                }
                frontBrakeBias = carStatus.m_frontBrakeBias;
            }            

            if (!drsOn && !this.tmBtLed.isFlashingYellow) { // Yellow flag and drs on overrides drs allowed
                if (carStatus.m_drsAllowed === 1) {
                    this.tmBtLed.setFlashingRightYellow(true);
                } else if (!drsOn) {
                    this.tmBtLed.setFlashingRightYellow(false);
                }
            }

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
        
            if (!this.tmBtLed.isFlashingYellow) { // Yellow flag overrides drs
                if (carTelemetry.m_drs === 1) {
                    drsOn = true;
                    this.tmBtLed.setFlashingRightYellow(false);
                    this.tmBtLed.setRightYellow(true);
                } else if (!this.tmBtLed.isFlashingRightYellow) {
                    drsOn = false;
                    this.tmBtLed.setRightYellow(false);
                }
            }
            
            if (this.tmBtLed.revLightsFlashing !== 1) { // No override because of pit limiter
                this.tmBtLed.setRevLights(carTelemetry.m_revLightsPercent);
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

export default F1;