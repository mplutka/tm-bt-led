/*
 * Template for a game client using udp data on port 20777
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

// Includes tmBtLed library, client functions and the udp listener
import { UdpListener } from './lib/udpListener.js';
import AbstractClient from './lib/abstractClient.mjs';

const gameTitle   = "GAMEDEMO";  // Game title, is shown while no other data is display. Max. 8 characters

const leftModes   = ["SPD", "RPM", "BRKT"];   // Mode titles for left display
const rightModes  = ["CLAP", "POS"];          // Mode titles for right display

class Game extends AbstractClient {
    port        = 20777;       // UDP port the client should listen on for telemetry data 
    
    // Telemetry structure according to documentation
    keys = [
        "speed",
        "rpm",  
        "gear",     
        "max_rpm",
        "current_lap_time",
        "position"
    ];

    constructor(...params) {
        super(...params);    

        this.initTmBtLed({
            onConnect: this.onDeviceConnected,
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode,
        });
    }

    onDeviceConnected = () =>  {
        this.client = new UdpListener({ port: this.port, bigintEnabled: true });
        console.log("5. Listening for game data on port "+ this.port +" ... GO!");
        this.client.on("data", this.parseData);
        this.client.start();
    }

    /**
     * Receives udp data from listenerm, parsed the data and maps the structured data to TmBtLed endpoints
     * @param message 
     */
    parseData = (message) => {
        // Debug
        console.log("Received message ", message);

        // Transform received udp data to structured data (game specific)
        const data = this.transformData(message);
      
        // Display current gear (-1: Reverse, 0: Neutral, 1-9: Gears )
        this.tmBtLed.setGear(data["gear"]);

        // Set RevLights as percentage
        this.tmBtLed.setRevLights(Math.ceil((data["rpm"] * 10) / (data["max_rpm"] * 10) * 100));

        // Set left display according to left modes array and currentLeftMode array index
        switch (this.currentLeftMode) {
            default:       
            case 0: // SPD
                // Set current speed, expects kmh (converted to mph automatically)
                this.tmBtLed.setSpeed(data["speed"] * 3.6);
                break;
            case 1: // RPM
                // Set current rpm as absolute number
                this.tmBtLed.setRpm(data["rpm"] * 10);
                break;                                                                                          
        }

        // Set right display according to right modes array and currentRightMode array index
        // Second boolean parameter (true) in setter displays value in right display
        switch (this.currentRightMode) {
            default:   
            case 0: // CLAP
                // Sets current lap time, expects milliseconds
                this.tmBtLed.setTime(data["current_lap_time"] * 1000, true);
                break;
            case 2: // POS
                // Sets current position, expects number
                this.tmBtLed.setInt(data["position"], true);
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
        const view = new DataView(message.buffer);
        let parsedData = {};
        let parsedKeys = 0;
        for (let i = 0; i < message.length; i++) {
            parsedData[this.keys[parsedKeys++]] = view.getFloat32(i, true);
            i += 3;
        }
        return parsedData;
    }
}

const game = new Game(gameTitle, leftModes, rightModes);