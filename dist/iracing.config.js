/**
 * iRacing config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "OILTEMP", "WATERTEMP", "LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"
 */

const config = {
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "OILTEMP", "WATERTEMP"],
    rightModes: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"],
    blueRevLightsIndicateShift: false
};

module.exports = config;