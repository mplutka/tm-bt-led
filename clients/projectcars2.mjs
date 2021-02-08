/*
 * Game client for Project Cars 2 & Automobilista 2
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import AbstractClient from '../lib/abstractClient.mjs';
import { UdpListener } from '../lib/udpListener.js';
import UdpParser from 'pcars2-udp/udp-parser.js';

const leftModes = ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "OILTEMP"];
const rightModes = ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"];

class ProjectCars2 extends AbstractClient {
    //port = 20777;       // UDP port the client should listen on for telemetry data 

    parser;
    numLaps = 0;
    localIndex = null;
    lastLap = 0;
    bestLap = 0;

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

        this.parser = new UdpParser('node_modules/pcars2-udp/SMS_UDP_Definitions.hpp');

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

        const gear = telemetry.sGearNumGears & 15;
        this.tmBtLed.setGear(gear === 15 ? -1 : gear);

        // Set RevLights as percentage
        let rpmPercent = telemetry.sRpm / telemetry.sMaxRpm * 100;
        if (rpmPercent < 60) {
            rpmPercent = 0;
        } else {
            rpmPercent = (rpmPercent - 60) / 40 * 100; 
        }
        this.tmBtLed.setRevLights(rpmPercent);

        // Set left display according to left modes array and currentLeftMode array index
        switch (this.currentLeftMode) {
            default:       
            case 0: // SPD
              this.tmBtLed.setSpeed(telemetry.sSpeed * 3.6);
              break;
            case 1: // RPM
              this.tmBtLed.setRpm(telemetry.sRpm);
              break;
            case 2: // FUEL
              this.tmBtLed.setFloat(telemetry.sFuelLevel * telemetry.sFuelCapacity);
              break;                  
            case 3: // TYRT
              const tyreTemps = telemetry.sTyreTemp[0] + telemetry.sTyreTemp[1] + telemetry.sTyreTemp[2] + telemetry.sTyreTemp[3];
              this.tmBtLed.setTemperature(tyreTemps / 4);
              break;                 
            case 4: // BRKT
              const brakeTemps = telemetry.sBrakeTempCelsius[0] + telemetry.sBrakeTempCelsius[1] + telemetry.sBrakeTempCelsius[2] + telemetry.sBrakeTempCelsius[3];
              this.tmBtLed.setTemperature(brakeTemps / 4);
              break;   
            case 5: // OILT
              this.tmBtLed.setTemperature(telemetry.sOilTempCelsius);
              break;                 
        }

        switch (this.currentRightMode) {
            case 1: // LLAP
                // Sets last lap time, expects milliseconds
                this.tmBtLed.setTime(this.lastLap, true);
                break;
            case 2: // BLAP
                // Sets last lap time, expects milliseconds
                this.tmBtLed.setTime(this.bestLap, true);
                break;                                        
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
        const timings = participantsData.sPartcipants[this.localIndex];

        switch (timings.sHighestFlag) {
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


        // Set right display according to right modes array and currentRightMode array index
        // Second boolean parameter (true) in setter displays value in right display
        switch (this.currentRightMode) {
            case 0: // CLAP
                // Sets current lap time, expects milliseconds
                this.tmBtLed.setTime(timings.sCurrentTime >= 0 ? timings.sCurrentTime * 1000 : 0, true);
                break;
            case 3: // POS
                // Sets current position, expects number
                this.tmBtLed.setInt(timings.sRacePosition % 128, true);
                break;               
            case 4: // LAP
                // Sets current lap, expects number
                this.tmBtLed.setInt(timings.sCurrentLap, true);
                break;
            case 5: // LEFT
                // Sets remaining laps, expects numner
                this.tmBtLed.setInt(this.numLaps > 0 ? this.numLaps - timings.sCurrentLap : 0, true);
                break;
        } 

    }     
}

export default ProjectCars2;