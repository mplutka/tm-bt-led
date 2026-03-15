/**
 * Assetto Corsa UDP config - add or delete modes for each display as you like
 * 
 * IMPORTANT: Enable UDP telemetry in Assetto Corsa:
 * Documents/Assetto Corsa/cfg/assetto_corsa.ini -> [REMOTE_TELEMETRY] -> ENABLED=1
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"
 * 
 * Rev lights options:
 * - blueRevLightsIndicateShift: Blue LEDs flash at 99% RPM
 * - flashingRevLightsIndicateShift: Blue LEDs flash above 90% RPM
 * - flashAllLedsAtMaxRpm: ALL LEDs flash rapidly when reaching max RPM (98%+)
 * 
 * UDP settings:
 * - udpPort: Port to listen on (default: 9996, must match AC settings)
 * - udpHost: Host address (default: 127.0.0.1)
 */

const config = {
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP"],
    rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"],
    blueRevLightsIndicateShift: false,
    flashingRevLightsIndicateShift: false,
    flashAllLedsAtMaxRpm: false,
    udpPort: 9996,
    udpHost: "127.0.0.1"
};

module.exports = config;
