/*
 * Game client for Forza series
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import { UdpListener } from '../src/udpListener.js';
import AbstractClient from '../src/abstractClient.mjs';

const leftModes   = ["SPEED", "RPM", "FUEL", "TYRETEMP"];                   // Mode titles for left display
const rightModes  = ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"];  // Mode titles for right display

class Forza extends AbstractClient {
   
    port = 20127;       // UDP port the client should listen on for telemetry data 

    // https://www.pocketplayground.net/rs-dash-fm7
    // https://github.com/zackdevine/FH4RP
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

        this.client = new UdpListener({ port: this.port, bigintEnabled: true });
        this.client.on("data", this.parseData);
    }

    startClient = () =>  {
        this.client.start();
    }

    stopClient = () => {
        this.client.stop();
    }

    /**
     * Receives udp data from listenerm, parsed the data and maps the structured data to TmBtLed endpoints
     * @param message 
     */
    parseData = (message) => {
        // console.log(message);
        // Transform received udp data to structured data
        const data = this.transformData(message);
      
        // Display current gear (10 -> -1: Reverse, 0: Neutral, 1-9: Gears )
        const gear = data["gear"];
        this.tmBtLed.setGear(gear >= 1 ? gear : gear === 0 ? -1 : 0);

        // Set RevLights as percentage
        this.tmBtLed.setRevLights(Math.ceil(data["currentEngineRpm"] / data["engineMaxRpm"] * 100));

        // Set brake pressure
        const brake = data["brake"];
        if (brake > 200) {
            this.tmBtLed.setLeftBlue(true);
            this.tmBtLed.setLeftRed(true);
            this.tmBtLed.setLeftYellow(true);
        } else if (brake > 100) {
            this.tmBtLed.setLeftBlue(false);
            this.tmBtLed.setLeftRed(true);
            this.tmBtLed.setLeftYellow(true);
        } else if (brake > 0) {
            this.tmBtLed.setLeftBlue(false);
            this.tmBtLed.setLeftRed(false);
            this.tmBtLed.setLeftYellow(true);
        } else {
            this.tmBtLed.setLeftBlue(false);
            this.tmBtLed.setLeftRed(false);
            this.tmBtLed.setLeftYellow(false);
        }

        // Set accel pressure
        const accel = data["accel"];
        if (accel > 200) {
            this.tmBtLed.setRightBlue(true);
            this.tmBtLed.setRightRed(true);
            this.tmBtLed.setRightYellow(true);
        } else if (accel > 100) {
            this.tmBtLed.setRightBlue(false);
            this.tmBtLed.setRightRed(true);
            this.tmBtLed.setRightYellow(true);
        } else if (accel > 0) {
            this.tmBtLed.setRightBlue(false);
            this.tmBtLed.setRightRed(false);
            this.tmBtLed.setRightYellow(true);
        } else {
            this.tmBtLed.setRightBlue(false);
            this.tmBtLed.setRightRed(false);
            this.tmBtLed.setRightYellow(false);
        }

        // Set left display according to left modes array and currentLeftMode array index
        switch (this.currentLeftMode) {
            default:       
            case 0: // SPD
              // Set current speed, expects kmh (converted to mph automatically)
              this.tmBtLed.setSpeed(data["speed"] * 3.6);
              break;
            case 1: // RPM
              // Set current rpm as absolute number
              this.tmBtLed.setRpm(data["currentEngineRpm"]);
              break;  
            case 2: // FUEL
              this.tmBtLed.setFloat(data["fuel"] * 100); // Percent
              break;                
            case 3: // TYRETEMP
              // Game provides brake temperature for each tyre. Calculate average here...
              let tyreTemps = (data["tireTempFrontLeft"] + data["tireTempFrontRight"] + data["tireTempRearLeft"] + data["tireTempRearRight"]) / 4;
              // Set current temperature (brakes), expects Celsius (converted to Fahrenheit automatically
              tyreTemps = (tyreTemps - 32) * (5 / 9);
              this.tmBtLed.setTemperature(tyreTemps);
              break;                                                                                             
        }

        // Set right display according to right modes array and currentRightMode array index
        // Second boolean parameter (true) in setter displays value in right display
        switch (this.currentRightMode) {
            default:   
            case 0: // CLAP
                // Sets current lap time, expects milliseconds
                this.tmBtLed.setTime(data["currentLap"] * 1000, true);
                break;
            case 1: // LLAP
                // Sets last lap time, expects milliseconds
                this.tmBtLed.setTime(data["lastLap"] * 1000, true);
                break;      
            case 2: // BEST
                // Sets best lap time, expects milliseconds
                this.tmBtLed.setTime(data["bestLap"] * 1000, true);
                break;                  
            case 3: // POS
                // Sets current position, expects number
                this.tmBtLed.setInt(data["racePosition"], true);
                break;               
            case 4: // LAP
                // Sets current lap, expects number
                this.tmBtLed.setInt(data["lapNumber"], true);
                break;
        }
    }

    /**
     * Transforms raw udp packet data as UInt8Array and returns game specific structured data
     * 
     * @param message 
     * @return parsedData
     */
    transformData = (message) => {
        let obj = {};
        let cnt = 0;
    
        obj.isRaceOn = message.readInt32LE(cnt);
        cnt += 4;
        obj.timestampMS = message.readUInt32LE(cnt); //Getting wrong data
        cnt += 4;
        obj.engineMaxRpm = message.readFloatLE(cnt);
        cnt += 4;
        obj.engineIdleRpm = message.readFloatLE(cnt);
        cnt += 4;
        obj.currentEngineRpm = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.accelerationX = message.readFloatLE(cnt); //In the car's local space; X = right, Y = up, Z = forward
        cnt += 4;
        obj.accelerationY = message.readFloatLE(cnt);
        cnt += 4;
        obj.accelerationZ = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.velocityX = message.readFloatLE(cnt); //In the car's local space; X = right, Y = up, Z = forward
        cnt += 4;
        obj.velocityY = message.readFloatLE(cnt);
        cnt += 4;
        obj.velocityZ = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.angularVelocityX = message.readFloatLE(cnt); //In the car's local space; X = pitch, Y = yaw, Z = roll
        cnt += 4;
        obj.angularVelocityY = message.readFloatLE(cnt);
        cnt += 4;
        obj.angularVelocityZ = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.yaw = message.readFloatLE(cnt);
        cnt += 4;
        obj.pitch = message.readFloatLE(cnt);
        cnt += 4;
        obj.roll = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.normalizedSuspensionTravelFrontLeft = message.readFloatLE(cnt); // Suspension travel normalized: 0.0f = max stretch; 1.0 = max compression
        cnt += 4;
        obj.normalizedSuspensionTravelFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.normalizedSuspensionTravelRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.normalizedSuspensionTravelRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.tireSlipRatioFrontLeft = message.readFloatLE(cnt); // Tire normalized slip ratio, = 0 means 100% grip and |ratio| > 1.0 means loss of grip.
        cnt += 4;
        obj.tireSlipRatioFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireSlipRatioRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireSlipRatioRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.wheelRotationSpeedFrontLeft = message.readFloatLE(cnt); // Wheel rotation speed radians/sec.
        cnt += 4; 
        obj.wheelRotationSpeedFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.wheelRotationSpeedRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.wheelRotationSpeedRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.wheelOnRumbleStripFrontLeft = message.readFloatLE(cnt); // = 1 when wheel is on rumble strip, = 0 when off.
        cnt += 4;
        obj.wheelOnRumbleStripFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.wheelOnRumbleStripRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.wheelOnRumbleStripRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.wheelInPuddleDepthFrontLeft = message.readFloatLE(cnt); // = from 0 to 1, where 1 is the deepest puddle
        cnt += 4;
        obj.wheelInPuddleDepthFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.wheelInPuddleDepthRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.wheelInPuddleDepthRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.surfaceRumbleFrontLeft = message.readFloatLE(cnt); // Non-dimensional surface rumble values passed to controller force feedback
        cnt += 4;
        obj.surfaceRumbleFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.surfaceRumbleRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.surfaceRumbleRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.tireSlipAngleFrontLeft = message.readFloatLE(cnt); // Tire normalized slip angle, = 0 means 100% grip and |angle| > 1.0 means loss of grip.
        cnt += 4;
        obj.tireSlipAngleFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireSlipAngleRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireSlipAngleRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.tireCombinedSlipFrontLeft = message.readFloatLE(cnt); // Tire normalized combined slip, = 0 means 100% grip and |slip| > 1.0 means loss of grip.
        cnt += 4;
        obj.tireCombinedSlipFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireCombinedSlipRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireCombinedSlipRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.suspensionTravelMetersFrontLeft = message.readFloatLE(cnt); // Actual suspension travel in meters
        cnt += 4;
        obj.suspensionTravelMetersFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.suspensionTravelMetersRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.suspensionTravelMetersRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.carOrdinal = message.readInt32LE(cnt); //Unique ID of the car make/model
        cnt += 4;
        obj.carClass = message.readInt32LE(cnt); //Between 0 (D -- worst cars) and 7 (X class -- best cars) inclusive 
        cnt += 4;
        obj.carPerformanceIndex = message.readInt32LE(cnt); //Between 100 (slowest car) and 999 (fastest car) inclusive
        cnt += 4;
        obj.drivetrainType = message.readInt32LE(cnt); //Corresponds to EDrivetrainType; 0 = FWD, 1 = RWD, 2 = AWD
        cnt += 4;
        obj.numCylinders = message.readInt32LE(cnt); //Number of cylinders in the engine
        cnt += 4;
    
        if (message.length === 324) { // FH4
            cnt += 12;
        }

        //Position (meters)

        if (message.length < 300) {
            console.warn("Wrong data format. Use \"DASH\"");
            return obj;
        }        

        obj.positionX = message.readFloatLE(cnt);
        cnt += 4;
        obj.positionY = message.readFloatLE(cnt);
        cnt += 4;
        obj.positionZ = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.speed = message.readFloatLE(cnt); // meters per second
        cnt += 4;
        obj.power = message.readFloatLE(cnt); // watts
        cnt += 4;
        obj.torque = message.readFloatLE(cnt); // newton meter
        cnt += 4;
    
        obj.tireTempFrontLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireTempFrontRight = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireTempRearLeft = message.readFloatLE(cnt);
        cnt += 4;
        obj.tireTempRearRight = message.readFloatLE(cnt);
        cnt += 4;
    
        obj.boost = message.readFloatLE(cnt);
        cnt += 4;
        obj.fuel = message.readFloatLE(cnt);
        cnt += 4;
        obj.distanceTraveled = message.readFloatLE(cnt);
        cnt += 4;
        obj.bestLap = message.readFloatLE(cnt); // seconds
        cnt += 4;
        obj.lastLap = message.readFloatLE(cnt); // seconds
        cnt += 4;
        obj.currentLap = message.readFloatLE(cnt); // seconds
        cnt += 4;
        obj.currentRaceTime = message.readFloatLE(cnt); // seconds
        cnt += 4;
    
        obj.lapNumber = message.readUInt16LE(cnt) + 1;
        cnt += 2;
        obj.racePosition = message.readUInt8(cnt);
        cnt += 1;
    
        obj.accel = message.readUInt8(cnt); // 0 - 255
        cnt += 1;
        obj.brake = message.readUInt8(cnt); // 0 - 255
        cnt += 1;
        obj.clutch = message.readUInt8(cnt);
        cnt += 1;
        obj.handBrake = message.readUInt8(cnt);
        cnt += 1;
        obj.gear = message.readUInt8(cnt);
        cnt += 1;
        obj.steer = message.readUInt8(cnt);
        cnt += 1;
    
        obj.normalizedDrivingLine = message.readUInt8(cnt);
        cnt += 1;
        obj.normalizedAIBrakeDifference = message.readUInt8(cnt);

        return obj;
    }
}

export default Forza;