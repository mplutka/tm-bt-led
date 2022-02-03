/**
 * Euro Truck Simulator config - add or delete mode for each display as you like and make a backup before overwriting with new version
 * 
 * Available modes: "SPEED", "RPM", "FUEL", "WATERTEMP", "OILTEMP", "OILPRESS", "AIRPRESS", "BRAKETEMP", "DISTANCE", "TIME", "SPEED LIMIT", "CRUISE CONT", "AVG CONSUM", "RANGE" 
 */

const config = {
    leftModes: ["SPEED", "RPM", "FUEL", "WATERTEMP", "OILTEMP", "OILPRESS", "AIRPRESS", "BRAKETEMP"],
    rightModes: ["DISTANCE", "TIME", "SPEED LIMIT", "CRUISE CONT", "AVG CONSUM", "RANGE"]
};

module.exports = config;