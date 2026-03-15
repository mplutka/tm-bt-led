/**
 * Assetto Corsa/Assetto Corsa Competizione config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"
 * Only available for ACC: "DELTA", "PRED LAP"
 * 
 * Rev lights options:
 * - blueRevLightsIndicateShift: Blue LEDs flash at 99% RPM
 * - flashingRevLightsIndicateShift: Blue LEDs flash above 90% RPM
 * - flashAllLedsAtMaxRpm: ALL LEDs flash rapidly when reaching max RPM (98%+)
 */

const config = {
    leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP"],
    rightModesAcc: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "PRED LAP", "POSITION", "LAP", "LAPS LEFT"],
    rightModesAssetto: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"],
    blueRevLightsIndicateShift: false,
    flashingRevLightsIndicateShift: false,
    flashAllLedsAtMaxRpm: false,
    lowerLightsIndicateAbsAndTcAction: false,
};

module.exports = config;
