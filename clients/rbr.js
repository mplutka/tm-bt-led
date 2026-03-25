/*
 * Game client for Richard Burns Rally (RBR) with NGP / RallySimFans UDP telemetry
 *
 * Uses RBR NGP telemetry struct (TelemetryData.h). Enable UDP in game/RSF:
 * typically port 6776, 127.0.0.1.
 *
 * Copyright (c) 2021 Markus Plutka
 */

const UdpListener = require('../lib/udpListener.js');
const AbstractClient = require('../lib/abstractClient.js');
const { getClientConfig } = require('../lib/configLoader.js');
const { resolveMaxRpmForRevLights } = require('../lib/resolveMaxRpm.js');

// RBR NGP TelemetryData struct byte offsets (packed, little-endian)
const OFF = {
    STAGE_PROGRESS: 8,
    STAGE_RACE_TIME: 12,
    STAGE_DISTANCE_TO_END: 20,
    CONTROL_STEERING: 24,
    CONTROL_THROTTLE: 28,
    CONTROL_BRAKE: 32,
    CONTROL_GEAR: 44,
    CAR_SPEED: 60,
    ENGINE_RPM: 136,
    // Brake disk temperature: after Car.engine (56+96=152), per Suspension (128 bytes), Wheel at +32, BrakeDisk.temperature_ at +4
    BRAKE_TEMP_LF: 152 + 32 + 4,
    BRAKE_TEMP_RF: 152 + 128 + 32 + 4,
    BRAKE_TEMP_LB: 152 + 256 + 32 + 4,
    BRAKE_TEMP_RB: 152 + 384 + 32 + 4
};

class RBRClient extends AbstractClient {
    detectedMaxRpm = 5000;

    config;
    modeMapping;

    constructor(tmBtLed) {
        if (!tmBtLed) {
            throw "No TM BT Led lib found.";
        }

        super(tmBtLed);

        this.modeMapping = {
            "SPEED": this.showSpeed,
            "RPM": this.showRpm,
            "BRAKETEMP": this.showBrakeTemp,
            "STAGE TIME": this.showStageTime,
            "DISTANCE": this.showDistance,
            "PROGRESS": this.showProgress
        };

        this.config = getClientConfig('rbr', 'rbr.config.js');

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

    startClient = () => {
        this.client.start();
    };

    stopClient = () => {
        this.client.stop();
    };

    parseData = (message) => {
        const data = this.transformData(message);
        if (!data) return;

        const gear = (data.gear || 0) - 1;
        this.tmBtLed.setGear(gear === -1 ? -1 : gear);

        const rpm = data.rpm || 0;
        const maxRpm = resolveMaxRpmForRevLights(
            { fallbackMaxRpm: this.config.fallbackMaxRpm, currentRpm: rpm },
            this
        );
        this.tmBtLed.setRevLights(Math.min(100, Math.max(0, Math.ceil((rpm / maxRpm) * 100))));

        if (this.currentLeftMode < this.leftModes.length) {
            const leftDataProcessor = this.modeMapping[this.leftModes[this.currentLeftMode]];
            if (typeof leftDataProcessor === "function") {
                leftDataProcessor(data, false);
            }
        }

        if (this.currentRightMode < this.rightModes.length) {
            const rightDataProcessor = this.modeMapping[this.rightModes[this.currentRightMode]];
            if (typeof rightDataProcessor === "function") {
                rightDataProcessor(data, true);
            }
        }
    };

    showSpeed = (data, onRight) => {
        this.tmBtLed.setSpeed(data.speed || 0, onRight);
    };

    showRpm = (data, onRight) => {
        this.tmBtLed.setRpm(data.rpm || 0, onRight);
    };

    showBrakeTemp = (data, onRight) => {
        const t = data.brake_temp_lf + data.brake_temp_rf + data.brake_temp_lb + data.brake_temp_rb;
        this.tmBtLed.setTemperature(t / 4, onRight);
    };

    showStageTime = (data, onRight) => {
        const raceTimeSec = data.race_time || 0;
        this.tmBtLed.setTime(raceTimeSec * 1000, onRight);
    };

    showDistance = (data, onRight) => {
        const dist = Math.round(data.distance_to_end || 0);
        this.tmBtLed.setInt(dist >= 0 ? dist : 0, onRight);
    };

    showProgress = (data, onRight) => {
        const pct = Math.round((data.progress || 0) * 100);
        this.tmBtLed.setInt(Math.min(100, Math.max(0, pct)), onRight);
    };

    /**
     * Parse RBR NGP UDP packet (TelemetryData struct).
     */
    transformData = (message) => {
        const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
        const len = view.byteLength;

        if (len < 152) return null;

        return {
            progress: view.getFloat32(OFF.STAGE_PROGRESS, true),
            race_time: view.getFloat32(OFF.STAGE_RACE_TIME, true),
            distance_to_end: view.getFloat32(OFF.STAGE_DISTANCE_TO_END, true),
            gear: view.getInt32(OFF.CONTROL_GEAR, true),
            speed: view.getFloat32(OFF.CAR_SPEED, true),
            rpm: view.getFloat32(OFF.ENGINE_RPM, true),
            brake_temp_lf: len > OFF.BRAKE_TEMP_LF + 4 ? view.getFloat32(OFF.BRAKE_TEMP_LF, true) : 0,
            brake_temp_rf: len > OFF.BRAKE_TEMP_RF + 4 ? view.getFloat32(OFF.BRAKE_TEMP_RF, true) : 0,
            brake_temp_lb: len > OFF.BRAKE_TEMP_LB + 4 ? view.getFloat32(OFF.BRAKE_TEMP_LB, true) : 0,
            brake_temp_rb: len > OFF.BRAKE_TEMP_RB + 4 ? view.getFloat32(OFF.BRAKE_TEMP_RB, true) : 0
        };
    }
}

module.exports = RBRClient;
