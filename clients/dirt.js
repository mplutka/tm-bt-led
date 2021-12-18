/*
 * Game client for Dirt series
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const UdpListener = require('../lib/udpListener.js');
const AbstractClient = require('../lib/abstractClient.js');

const leftModes   = ["SPEED", "RPM", "BRAKETEMP"];                   // Mode titles for left display
const rightModes  = ["LAPTIME", "LAST LAP", "DISTANCE", "POSITION", "LAP", "LAPS LEFT"];  // Mode titles for right display

class DirtRally extends AbstractClient {
   
    port = 20777;       // UDP port the client should listen on for telemetry data 

    // Telemetry structure according to documentation
    keys = [
        "total_time",
        "lap_time",
        "lap_distance",
        "total_distance",
        "position_x",
        "position_y",
        "position_z",
        "speed",
        "velocity_x",
        "velocity_y",
        "velocity_z",
        "left_dir_x",
        "left_dir_y",
        "left_dir_z",
        "forward_dir_x",
        "forward_dir_y",
        "forward_dir_z",
        "suspension_position_bl",
        "suspension_position_br",
        "suspension_position_fl",
        "suspension_position_fr",
        "suspension_velocity_bl",
        "suspension_velocity_br",
        "suspension_velocity_fl",
        "suspension_velocity_fr",
        "wheel_patch_speed_bl",
        "wheel_patch_speed_br",
        "wheel_patch_speed_fl",
        "wheel_patch_speed_fr",
        "throttle_input",
        "steering_input",
        "brake_input",
        "clutch_input",
        "gear",
        "gforce_lateral",
        "gforce_longitudinal",
        "lap",
        "engine_rate",
        "native_sli_support",
        "race_position",
        "kers_level",
        "kers_level_max",
        "drs",
        "traction_control",
        "abs",
        "fuel_in_tank",
        "fuel_capacity",
        "in_pits",
        "race_sector",
        "sector_time_1",
        "sector_time_2",
        "brake_temp_bl",
        "brake_temp_br",
        "brake_temp_fl",
        "brake_temp_fr",
        "tyre_pressure_bl",
        "tyre_pressure_br",
        "tyre_pressure_fl",
        "tyre_pressure_fr",
        "laps_completed",
        "total_laps",
        "track_length",
        "last_lap_time",
        "max_rpm",
        "idle_rpm",
        "max_gears"
    ];

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
        // Transform received udp data to structured data
        const data = this.transformData(message);
      
        // Display current gear (10 -> -1: Reverse, 0: Neutral, 1-9: Gears )
        this.tmBtLed.setGear(data["gear"] == 10 ? -1 : data["gear"]);

        // Set RevLights as percentage
        this.tmBtLed.setRevLights(Math.ceil((data["engine_rate"] * 10) / (data["max_rpm"] * 10) * 100));

        // Set left display according to left modes array and currentLeftMode array index
        switch (this.currentLeftMode) {
            default:       
            case 0: // SPD
              // Set current speed, expects kmh (converted to mph automatically)
              this.tmBtLed.setSpeed(data["speed"] * 3.6);
              break;
            case 1: // RPM
              // Set current rpm as absolute number
              this.tmBtLed.setRpm(data["engine_rate"] * 10);
              break;  
            case 2: // BRKT
              // Game provides brake temperature for each tyre. Calculate average here...
              const brakeTemps = data["brake_temp_bl"] + data["brake_temp_br"] + data["brake_temp_fl"] + data["brake_temp_fr"];
              // Set current temperature (brakes), expects Celsius (converted to Fahrenheit automatically
              this.tmBtLed.setTemperature(brakeTemps / 4);
              break;                                                                                             
        }

        // Set right display according to right modes array and currentRightMode array index
        // Second boolean parameter (true) in setter displays value in right display
        switch (this.currentRightMode) {
            default:   
            case 0: // CLAP
                // Sets current lap time, expects milliseconds
                this.tmBtLed.setTime(data["lap_time"] * 1000, true);
                break;
            case 1: // LLAP
                // Sets last lap time, expects milliseconds
                this.tmBtLed.setTime(data["last_lap_time"] * 1000, true);
                break;      
            case 2: // DIST
                // Sets distance left in metres
                const dist = data["track_length"] - data["lap_distance"];
                this.tmBtLed.setInt(dist > 0 ? dist : 0, true);
                break;                   
            case 3: // POS
                // Sets current position, expects number
                this.tmBtLed.setInt(data["race_position"], true);
                break;               
            case 4: // LAP
                // Sets current lap, expects number
                this.tmBtLed.setInt(data["lap"], true);
                break;
            case 5: // LEFT
                // Sets remaining laps, expects numner
                this.tmBtLed.setInt(data["total_laps"] - data["laps_completed"], true);
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

module.exports = DirtRally;