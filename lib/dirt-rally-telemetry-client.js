"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgram = __importStar(require("dgram"));
const events_1 = require("events");
const DEFAULT_PORT = 20777;
exports.DEFAULT_PORT = DEFAULT_PORT;
const BIGINT_ENABLED = true;
/**
 *
 */
class DirtRallyTelemetryClient extends events_1.EventEmitter {
    constructor(opts = {}) {
        super();
        const { port = DEFAULT_PORT, bigintEnabled = BIGINT_ENABLED } = opts;
        this.port = port;
        this.bigintEnabled = bigintEnabled;
        this.client = dgram.createSocket('udp4');
    }
    /**
     *
     * @param {Buffer} message
     */
    parseMessage(message) {

        const keys = [
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


        const view = new DataView(message.buffer);
        let parsedData = {};
        let parsedKeys = 0;
        for (let i = 0; i < message.length; i++) {
            parsedData[keys[parsedKeys++]] = view.getFloat32(i, true);
            i += 3;
        }
        

        this.emit("data", parsedData);
    }
    /**
     * Method to start listening for packets
     */
    start() {
        if (!this.client) {
            return;
        }
        this.client.on('listening', () => {
            if (!this.client) {
                return;
            }
            const address = this.client.address();
            console.log(`UDP Client listening on ${address.address}:${address.port} 🏎`);
            this.client.setBroadcast(true);
        });
        this.client.on('message', (m) => this.parseMessage(m));
        this.client.bind(this.port);
    }
    /**
     * Method to close the client
     */
    stop() {
        if (!this.client) {
            return;
        }
        return this.client.close(() => {
            console.log(`UDP Client closed 🏁`);
            this.client = undefined;
        });
    }
}
exports.DirtRallyTelemetryClient = DirtRallyTelemetryClient;
