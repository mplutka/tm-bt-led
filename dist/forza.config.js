/**
 * Forza config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"
 */

const config = {
    port: 20127,
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP"],
    rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"]
};

module.exports = config;