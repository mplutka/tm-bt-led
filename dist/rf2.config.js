/**
 * rFactor2 config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "TYREPRESS", "BRAKETEMP", "OILTEMP", "LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"
 */

const config = {
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "TYREPRESS", "BRAKETEMP", "OILTEMP"],
    rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
};

module.exports = config;