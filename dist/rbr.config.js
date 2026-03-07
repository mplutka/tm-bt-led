/**
 * Richard Burns Rally config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "BRAKETEMP", "STAGE TIME", "DISTANCE", "PROGRESS"
 */

const config = {
    port: 6776,
    leftModes: ["SPEED", "RPM", "BRAKETEMP"],
    rightModes: ["STAGE TIME", "DISTANCE", "PROGRESS"],
    fallbackMaxRpm: 7500
};

module.exports = config;