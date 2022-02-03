/**
 * F1 config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "ENGINETEMP", "ERSLEVEL", "LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"
 */

const config = {
    port: 20777,
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "ENGINETEMP", "ERSLEVEL"],
    rightModes: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};

module.exports = config;