/*
 * Game client for F1 20xx
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { F1TelemetryClient, constants } from 'f1-telemetry-client';
import AbstractClient from './lib/abstractClient.mjs';
const { PACKETS } = constants;


const leftModes = ["SPD", "RPM", "FUEL", "TYRT", "ENGT"];
const rightModes = ["CLAP", "LLAP", "BLAP", "POS", "LAP", "LEFT"];

const gameTitle = "  F120XX";

class F120XX extends AbstractClient {
    port = 20777;       // UDP port the client should listen on for telemetry data 

    constructor(...params) {
        super(...params);    

        this.initTmBtLed({
            onConnect: this.onDeviceConnected,
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode,
        });
        this.client = new F1TelemetryClient({ port: this.port, bigintEnabled: true });
    }

    onDeviceConnected = () =>  {     
        console.log("5. Listening for game data on port "+ this.port +" ... GO!");

        let totalLaps = 60;
        // https://f1-2019-telemetry.readthedocs.io/en/latest/telemetry-specification.html
        /*client.on(PACKETS.event, console.log);
        client.on(PACKETS.motion, console.log);
        client.on(PACKETS.carSetups, console.log);
        client.on(PACKETS.participants, console.log);*/

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
        });
        let drsOn = false;
        this.client.on(PACKETS.carStatus, d => {
            const myIndex = d.m_header.m_playerCarIndex;
            const carStatus = d.m_carStatusData[myIndex];

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
                  const tempSum = carTelemetry.m_tyresSurfaceTemperature.reduce((a, b) => a + b, 0);
                  const tempAvg = (tempSum / carTelemetry.m_tyresSurfaceTemperature.length) || 0;
                  this.tmBtLed.setTemperature(tempAvg, false);
                  break;                       
                case 4:
                  this.tmBtLed.setTemperature(carTelemetry.m_engineTemperature, false);
                  break; 
                                                                                           
            }
        });
        this.client.start();
    }
}

const f120XX = new F120XX(gameTitle, leftModes, rightModes);