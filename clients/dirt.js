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
const { getClientConfig } = require('../lib/configLoader.js');
const { resolveMaxRpmForRevLights } = require('../lib/resolveMaxRpm.js');

class DirtRally extends AbstractClient {
    detectedMaxRpm = 5000;

    config;
    modeMapping;

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

        this.modeMapping = {
            "SPEED": this.showSpeed,
            "RPM": this.showRpm,
            "FUEL": this.showFuel,
            "BRAKETEMP": this.showBrakeTemp,
            "LAPTIME": this.showCurrentLap,
            "LAST LAP": this.showLastLap,
            "DISTANCE": this.showDistance,
            "POSITION": this.showPosition,
            "LAP": this.showLapNumber,
            "LAPS LEFT": this.showLapsLeft,
        };

        this.config = getClientConfig('dirt', 'dirt.config.js');
        
        this.setCallbacks({
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode
        });
        this.setModes(this.config.leftModes, this.config.rightModes);

        this.client = new UdpListener({ 
            port: this.config.port, 
            forwardPorts: this.config.forwardPorts || [],
            bigintEnabled: true 
        });
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

        // Set RevLights as percentage (engine_rate / max_rpm in game units; RPM = rate * 10)
        const rate = data["engine_rate"];
        const currentRpm =
            typeof rate === 'number' && isFinite(rate) ? rate * 10 : 0;
        const rawMax = data["max_rpm"];
        const telemetryMaxRpm =
            typeof rawMax === 'number' && isFinite(rawMax) && rawMax > 0 ? rawMax * 10 : undefined;
        const maxRpmRpm = resolveMaxRpmForRevLights(
            {
                telemetryMaxRpm,
                fallbackMaxRpm: this.config.fallbackMaxRpm,
                currentRpm
            },
            this
        );
        const maxRpmRate = maxRpmRpm / 10;
        const er = typeof rate === 'number' && isFinite(rate) ? rate : 0;
        this.tmBtLed.setRevLights(
            maxRpmRate > 0 ? Math.ceil((er / maxRpmRate) * 100) : 0
        );

        // Set left display according to left modes array and currentLeftMode array index
        if (this.currentLeftMode <= this.leftModes.length) {
            const leftDataProcessor = this.modeMapping[this.leftModes[this.currentLeftMode]];
            if (typeof leftDataProcessor === "function") {
                leftDataProcessor(data, false);
            }
        }

        // Set right display according to right modes array and currentRightMode array index
        // Second boolean parameter (true) in setter displays value in right display
        if (this.currentRightMode <= this.rightModes.length) {
            const rightDataProcessor = this.modeMapping[this.rightModes[this.currentRightMode]];
            if (typeof rightDataProcessor === "function") {
                rightDataProcessor(data, true);
            }
        }
    }

    showCurrentLap = (data, onRight) => {
        // Sets current lap time, expects milliseconds
        this.tmBtLed.setTime(data["lap_time"] * 1000, onRight);
    };

    showLastLap = (data, onRight) => {
        // Sets last lap time, expects milliseconds
        this.tmBtLed.setTime(data["last_lap_time"] * 1000, onRight);
    }

    showDistance = (data, onRight) => {
        // Sets distance left in metres
        const dist = data["track_length"] - data["lap_distance"];
        this.tmBtLed.setInt(dist > 0 ? dist : 0, onRight);
    };

    showPosition = (data, onRight) => {
        // Sets current position, expects number
        this.tmBtLed.setInt(data["race_position"], onRight);
    };

    showLapNumber = (data, onRight) => {
        // Sets current lap, expects number
        this.tmBtLed.setInt(data["lap"], onRight);
    };

    showLapsLeft = (data, onRight) => {
        // Sets remaining laps, expects numner
        this.tmBtLed.setInt(data["total_laps"] - data["laps_completed"], onRight);
    };

    showSpeed = (data, onRight) => {
        // Set current speed, expects kmh (converted to mph automatically)
        this.tmBtLed.setSpeed(data["speed"] * 3.6, onRight);
    };

    showRpm = (data, onRight) => {
        // Set current rpm as absolute number
        this.tmBtLed.setRpm(data["engine_rate"] * 10, onRight);
    };

    showBrakeTemp = (data, onRight) => {
        // Game provides brake temperature for each tyre. Calculate average here...
        const brakeTemps = data["brake_temp_bl"] + data["brake_temp_br"] + data["brake_temp_fl"] + data["brake_temp_fr"];
        // Set current temperature (brakes), expects Celsius (converted to Fahrenheit automatically
        this.tmBtLed.setTemperature(brakeTemps / 4, onRight);
    };



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