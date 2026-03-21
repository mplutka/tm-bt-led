/*
 * Game client for EA Sports WRC
 *
 * Created Date: Wednesday, March 18th 2026
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021-2026 Markus Plutka
 * 
 * EA WRC uses a JSON-configurable UDP telemetry system.
 * Default config location: Documents/My Games/WRC/telemetry/config.json
 * 
 * This client parses the default "wrc" / "custom1" session_update layout from
 * readme/udp/wrc.json (channel order and types per readme/channels.json).
 */

const UdpListener = require('../lib/udpListener.js');
const AbstractClient = require('../lib/abstractClient.js');
const { getClientConfig } = require('../lib/configLoader.js');
const { resolveRevLightFlash } = require('../lib/revLightFlash.js');

class WRC extends AbstractClient {
    config;
    modeMapping;

    /*
     * session_update: channels only (header empty in wrc.json); first field is packet_uid.
     * Packed size is 237 bytes (tight); some builds insert 3-byte padding after shiftlights_rpm_valid → 240.
     * Optional 4-byte fourcc before payload → 241 or 244 bytes total.
     * All values are little-endian.
     */
    packetStructure = [
        { name: "packet_uid", type: "uint64" },           // Unique packet ID

        // Game timing (24 bytes) — must appear before shift lights in official schema
        { name: "game_total_time", type: "float32" },
        { name: "game_delta_time", type: "float32" },
        { name: "game_frame_count", type: "uint64" },

        // Shift lights (3 floats + boolean; gear follows immediately in tight packing)
        { name: "shiftlights_fraction", type: "float32" },
        { name: "shiftlights_rpm_start", type: "float32" },
        { name: "shiftlights_rpm_end", type: "float32" },
        { name: "shiftlights_rpm_valid", type: "uint8" },

        // Gear data (4 bytes)
        { name: "vehicle_gear_index", type: "uint8" },
        { name: "vehicle_gear_index_neutral", type: "uint8" },
        { name: "vehicle_gear_index_reverse", type: "uint8" },
        { name: "vehicle_gear_maximum", type: "uint8" },

        // Vehicle speed/transmission (8 bytes)
        { name: "vehicle_speed", type: "float32" },
        { name: "vehicle_transmission_speed", type: "float32" },

        // Vehicle position (12 bytes)
        { name: "vehicle_position_x", type: "float32" },
        { name: "vehicle_position_y", type: "float32" },
        { name: "vehicle_position_z", type: "float32" },

        // Vehicle velocity (12 bytes)
        { name: "vehicle_velocity_x", type: "float32" },
        { name: "vehicle_velocity_y", type: "float32" },
        { name: "vehicle_velocity_z", type: "float32" },

        // Vehicle acceleration (12 bytes)
        { name: "vehicle_acceleration_x", type: "float32" },
        { name: "vehicle_acceleration_y", type: "float32" },
        { name: "vehicle_acceleration_z", type: "float32" },

        // Vehicle directions (36 bytes)
        { name: "vehicle_left_direction_x", type: "float32" },
        { name: "vehicle_left_direction_y", type: "float32" },
        { name: "vehicle_left_direction_z", type: "float32" },
        { name: "vehicle_forward_direction_x", type: "float32" },
        { name: "vehicle_forward_direction_y", type: "float32" },
        { name: "vehicle_forward_direction_z", type: "float32" },
        { name: "vehicle_up_direction_x", type: "float32" },
        { name: "vehicle_up_direction_y", type: "float32" },
        { name: "vehicle_up_direction_z", type: "float32" },

        // Suspension hub position (16 bytes)
        { name: "vehicle_hub_position_bl", type: "float32" },
        { name: "vehicle_hub_position_br", type: "float32" },
        { name: "vehicle_hub_position_fl", type: "float32" },
        { name: "vehicle_hub_position_fr", type: "float32" },

        // Suspension hub velocity (16 bytes)
        { name: "vehicle_hub_velocity_bl", type: "float32" },
        { name: "vehicle_hub_velocity_br", type: "float32" },
        { name: "vehicle_hub_velocity_fl", type: "float32" },
        { name: "vehicle_hub_velocity_fr", type: "float32" },

        // Contact patch forward speed (16 bytes)
        { name: "vehicle_cp_forward_speed_bl", type: "float32" },
        { name: "vehicle_cp_forward_speed_br", type: "float32" },
        { name: "vehicle_cp_forward_speed_fl", type: "float32" },
        { name: "vehicle_cp_forward_speed_fr", type: "float32" },

        // Brake temperatures (16 bytes)
        { name: "vehicle_brake_temperature_bl", type: "float32" },
        { name: "vehicle_brake_temperature_br", type: "float32" },
        { name: "vehicle_brake_temperature_fl", type: "float32" },
        { name: "vehicle_brake_temperature_fr", type: "float32" },

        // Engine data (12 bytes)
        { name: "vehicle_engine_rpm_max", type: "float32" },
        { name: "vehicle_engine_rpm_idle", type: "float32" },
        { name: "vehicle_engine_rpm_current", type: "float32" },

        // Input data (20 bytes)
        { name: "vehicle_throttle", type: "float32" },
        { name: "vehicle_brake", type: "float32" },
        { name: "vehicle_clutch", type: "float32" },
        { name: "vehicle_steering", type: "float32" },
        { name: "vehicle_handbrake", type: "float32" },

        // Stage data — distances are float64 in channels.json
        { name: "stage_current_time", type: "float32" },
        { name: "stage_current_distance", type: "float64" },
        { name: "stage_length", type: "float64" }
    ];

    /** Same as packetStructure but 3-byte pad after shiftlights_rpm_valid (240-byte wire format). */
    packetStructurePadded;

    lastStageTime = 0;
    bestStageTime = 0;

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
            "BEST TIME": this.showBestTime,
            "DISTANCE": this.showDistance,
            "PROGRESS": this.showProgress
        };

        this.config = getClientConfig('wrc', 'wrc.config.js');
        this.revFlashProfile = resolveRevLightFlash(this.config);
        this.tmBtLed.setRevLightFlashProfile(this.revFlashProfile);

        this.setCallbacks({
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode
        });
        this.setModes(this.config.leftModes, this.config.rightModes);

        const idxShiftValid = this.packetStructure.findIndex((f) => f.name === 'shiftlights_rpm_valid');
        this.packetStructurePadded = [
            ...this.packetStructure.slice(0, idxShiftValid + 1),
            { name: '_shift_pad1', type: 'uint8', skip: true },
            { name: '_shift_pad2', type: 'uint8', skip: true },
            { name: '_shift_pad3', type: 'uint8', skip: true },
            ...this.packetStructure.slice(idxShiftValid + 1)
        ];

        this.client = new UdpListener({
            port: this.config.port,
            forwardPorts: this.config.forwardPorts || [],
            bigintEnabled: true
        });
        this.client.on("data", this.parseData);
    }

    startClient = () => {
        console.log("Starting EA Sports WRC client...");
        console.log(`Listening on UDP port ${this.config.port}`);
        console.log("Make sure UDP telemetry is enabled in EA Sports WRC:");
        console.log("  Documents/My Games/WRC/telemetry/config.json");
        this.client.start();
    }

    stopClient = () => {
        this.client.stop();
    }

    parseData = (message) => {
        const lenTight = 237;
        const lenPadded = 240;
        let payload = message;
        // Optional fourcc prefix (4 + 237 = 241, 4 + 240 = 244)
        if (message.length === lenTight + 4 || message.length === lenPadded + 4) {
            payload = message.subarray(4);
        }
        let structure = this.packetStructure;
        if (payload.length === lenPadded) {
            structure = this.packetStructurePadded;
        } else if (payload.length !== lenTight) {
            return;
        }

        const data = this.transformData(payload, structure);

        if (!data) return;

        const gearIndex = data["vehicle_gear_index"];
        const neutralIndex = data["vehicle_gear_index_neutral"];
        const reverseIndex = data["vehicle_gear_index_reverse"];

        let displayGear;
        if (gearIndex === neutralIndex) {
            displayGear = 0;
        } else if (gearIndex === reverseIndex) {
            displayGear = -1;
        } else if (gearIndex > neutralIndex) {
            displayGear = gearIndex - neutralIndex;
        } else {
            displayGear = gearIndex;
        }
        this.tmBtLed.setGear(displayGear);

        this.handleRevLights(data);

        if (data["vehicle_engine_rpm_current"] > 0) {
            this.tmBtLed.setGearDot(true);
        } else {
            this.tmBtLed.setGearDot(false);
        }

        if (data["stage_current_time"] < this.lastStageTime && this.lastStageTime > 10) {
            if (this.bestStageTime === 0 || this.lastStageTime < this.bestStageTime) {
                this.bestStageTime = this.lastStageTime;
            }
        }
        this.lastStageTime = data["stage_current_time"];

        if (this.currentLeftMode <= this.leftModes.length) {
            const leftDataProcessor = this.modeMapping[this.leftModes[this.currentLeftMode]];
            if (typeof leftDataProcessor === "function") {
                leftDataProcessor(data, false);
            }
        }

        if (this.currentRightMode <= this.rightModes.length) {
            const rightDataProcessor = this.modeMapping[this.rightModes[this.currentRightMode]];
            if (typeof rightDataProcessor === "function") {
                rightDataProcessor(data, true);
            }
        }
    }

    handleRevLights(data) {
        const currentRpm = data["vehicle_engine_rpm_current"];
        const shiftStart = data["shiftlights_rpm_start"];
        const shiftEnd = data["shiftlights_rpm_end"];
        const shiftFraction = data["shiftlights_fraction"];

        if (data["shiftlights_rpm_valid"] && shiftStart > 0 && shiftEnd > 0) {
            let rpmPercent;
            if (currentRpm < shiftStart) {
                rpmPercent = (currentRpm / shiftStart) * 50;
            } else {
                rpmPercent = 50 + ((currentRpm - shiftStart) / (shiftEnd - shiftStart)) * 50;
            }
            rpmPercent = Math.min(100, Math.max(0, rpmPercent));

            if (this.revFlashProfile.maxRpm.enabled && shiftFraction >= 1.0) {
                this.tmBtLed.setRevLightsFlashing(2);
            } else {
                this.tmBtLed.setRevLightsFlashing(0);
            }

            if (!this.tmBtLed.shouldApplyClientRevLights()) {
                return;
            }

            const shiftStyle = this.revFlashProfile.shift.style;
            if (shiftStyle === 'blue_late') {
                this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);
                if (shiftFraction >= 0.95) {
                    this.tmBtLed.setRevLightsBlueFlashing(1);
                } else {
                    this.tmBtLed.setRevLightsBlueFlashing(0);
                }
                return;
            }
            if (shiftStyle === 'blue_early') {
                if (shiftFraction < 0.8) {
                    this.tmBtLed.setRevLights(rpmPercent);
                    this.tmBtLed.setRevLightsBlueFlashing(0);
                } else {
                    this.tmBtLed.setRevLightsWithoutBlue(rpmPercent);
                    this.tmBtLed.setRevLightsBlueFlashing(1);
                }
                return;
            }
            this.tmBtLed.setRevLights(shiftFraction >= 0.98 ? 100 : rpmPercent);
        } else {
            let maxRpm = data["vehicle_engine_rpm_max"];
            if (!maxRpm || maxRpm <= 0) {
                maxRpm = this.config.fallbackMaxRpm || 7500;
            }
            if (!maxRpm || maxRpm <= 0) {
                this.tmBtLed.setRevLights(0);
                return;
            }
            let rpmPercent = (currentRpm / maxRpm) * 100;
            rpmPercent = rpmPercent < 50 ? 0 : ((rpmPercent - 50) / 50) * 100;
            this.tmBtLed.setRevLights(rpmPercent >= 98 ? 100 : rpmPercent);
        }
    }

    showSpeed = (data, onRight) => {
        this.tmBtLed.setSpeed(data["vehicle_speed"] * 3.6, onRight);
    };

    showRpm = (data, onRight) => {
        this.tmBtLed.setRpm(data["vehicle_engine_rpm_current"], onRight);
    };

    showBrakeTemp = (data, onRight) => {
        const keys = [
            "vehicle_brake_temperature_bl",
            "vehicle_brake_temperature_br",
            "vehicle_brake_temperature_fl",
            "vehicle_brake_temperature_fr"
        ];
        const wheels = keys.map((k) => {
            const v = Number(data[k]);
            return Number.isFinite(v) ? v : 0;
        });
        // Hottest corner: drops as soon as the warmest rotor cools. A mean can stay high if one wheel lags.
        const display = wheels.length ? Math.max(...wheels) : 0;
        this.tmBtLed.setTemperature(display, onRight);
    };

    showStageTime = (data, onRight) => {
        this.tmBtLed.setTime(data["stage_current_time"] * 1000, onRight);
    };

    showBestTime = (data, onRight) => {
        if (this.bestStageTime > 0) {
            this.tmBtLed.setTime(this.bestStageTime * 1000, onRight);
        } else {
            this.tmBtLed.setTime(0, onRight);
        }
    };

    showDistance = (data, onRight) => {
        const dist = data["stage_length"] - data["stage_current_distance"];
        this.tmBtLed.setInt(dist > 0 ? Math.round(dist) : 0, onRight);
    };

    showProgress = (data, onRight) => {
        const progress = data["stage_length"] > 0 
            ? (data["stage_current_distance"] / data["stage_length"]) * 100 
            : 0;
        this.tmBtLed.setInt(Math.round(progress), onRight);
    };

    transformData = (message, structure = this.packetStructure) => {
        const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
        let parsedData = {};
        let offset = 0;

        for (const field of structure) {
            if (offset >= message.length) break;

            try {
                switch (field.type) {
                    case "uint8":
                        parsedData[field.name] = view.getUint8(offset);
                        offset += 1;
                        break;
                    case "uint32":
                        parsedData[field.name] = view.getUint32(offset, true);
                        offset += 4;
                        break;
                    case "uint64":
                        const low = view.getUint32(offset, true);
                        const high = view.getUint32(offset + 4, true);
                        parsedData[field.name] = BigInt(low) + (BigInt(high) << 32n);
                        offset += 8;
                        break;
                    case "float32":
                        parsedData[field.name] = view.getFloat32(offset, true);
                        offset += 4;
                        break;
                    case "float64":
                        parsedData[field.name] = view.getFloat64(offset, true);
                        offset += 8;
                        break;
                    default:
                        offset += 4;
                }
            } catch (e) {
                break;
            }
        }

        return parsedData;
    }
}

module.exports = WRC;
