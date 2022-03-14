/**
 * Assetto Corsa/Assetto Corsa Competizione config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"
 * Only available for ACC: "DELTA", "PRED LAP"
 */

const config = {
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP"],
    rightModesAcc: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "PRED LAP", "POSITION", "LAP", "LAPS LEFT"],
    rightModesAssetto: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};

module.exports = config;