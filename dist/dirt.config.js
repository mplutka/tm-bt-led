/**
 * Dirt config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "BRAKETEMP", "LAPTIME", "LAST LAP", "DISTANCE", "POSITION", "LAP", "LAPS LEFT"
 */

const config = {
    port: 20777,
    leftModes: ["SPEED", "RPM", "BRAKETEMP"],
    rightModes: ["LAPTIME", "LAST LAP", "DISTANCE", "POSITION", "LAP", "LAPS LEFT"],
    fallbackMaxRpm: 7500
};

module.exports = config;