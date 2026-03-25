/*
 * Global JSON config loader for all game clients
 *
 * Created Date: Sunday, March 15th 2026
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021-2026 Markus Plutka
 */

const fs = require('fs');
const path = require('path');

const GLOBAL_CONFIG_FILENAME = "config.json";

const defaultGlobalConfig = {
    debug: false,
    fps: 60,
    queueDepth: 2,
    metric: false,
    imperial: false,
    message: ""
};

const defaultConfigs = {
    f1: {
        executables: ["f1_2019.exe", "f1_2019_dx12.exe", "f1_2020.exe", "f1_2020_dx12.exe", "f1_2021_dx12.exe", "f1_2022_dx12.exe", "f1_23.exe", "f1_24.exe", "f1_25.exe"],
        title: [" F1 ", "20XX"],
        port: 20777,
        internalPort: 20778,
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "ENGINETEMP", "ERSLEVEL"],
        rightModes: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"],
        revLightFlash: {
            pitLimiterSpeed: 'slow',
            shift: { style: 'off', speed: 'fast' },
            maxRpm: { enabled: false, colors: ['all'], speed: 'fast' }
        }
    },
    dirt: {
        executables: ["dirt3_game.exe", "drt4.exe", "drt.exe", "dirtrally2.exe", "gridlegends.exe"],
        title: ["DIRT", "RALLY"],
        port: 20777,
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "BRAKETEMP"],
        rightModes: ["LAPTIME", "LAST LAP", "DISTANCE", "POSITION", "LAP", "LAPS LEFT"],
        fallbackMaxRpm: 5000
    },
    forza: {
        executables: ["forzamotorsport7.exe", "forzahorizon4.exe", "forzahorizon5.exe"],
        title: [" FOR", "ZA  "],
        port: 20127,
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP"],
        rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP"]
    },
    rbr: {
        executables: ["RichardBurnsRally_SSE.exe", "richardburnsrally.exe", "richardburnsrally_sse.exe", "rbr.exe"],
        title: ["RICH", "BURNS"],
        port: 6776,
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "BRAKETEMP"],
        rightModes: ["STAGE TIME", "DISTANCE", "PROGRESS"],
        fallbackMaxRpm: 5000
    },
    projectcars2: {
        executables: ["ams2avx.exe", "ams2.exe", "pcars3.exe", "pcars3avx.exe", "pcars2.exe", "pcars2avx.exe"],
        title: ["PROJECT", "CARS 2"],
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP", "OILTEMP"],
        rightModes: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT"]
    },
    assetto: {
        executables: ["acc.exe", "acr.exe", "assettocorsa.exe", "AssettoCorsaEVO.exe"],
        title: ["ASSETTO", "CORSA"],
        leftModes: ["SPEED", "RPM", "FUEL", "TYRETEMP", "BRAKETEMP"],
        rightModesAcc: ["LAPTIME", "DELTA", "LAST LAP", "BEST LAP", "PRED LAP", "POSITION", "LAP", "LAPS LEFT", "DISTANCE"],
        rightModesAssetto: ["LAPTIME", "LAST LAP", "BEST LAP", "POSITION", "LAP", "LAPS LEFT", "DISTANCE"],
        fallbackMaxRpm: 5000,
        revLightFlash: {
            pitLimiterSpeed: 'slow',
            shift: { style: 'off', speed: 'fast' },
            maxRpm: { enabled: false, colors: ['all'], speed: 'fast' }
        },
        lowerLightsIndicateAbsAndTcAction: false
    },
    "dump_udp": {
        executables: [],
        title: ["DMPS", "   0"]
    },
    "_template": {
        executables: [],
        title: ["TEMP", "LATE"]
    },
    iracing: {
        executables: ["iRacingUI.exe", "iRacingSim64DX11.exe"],
        title: ["IRAC", "ING"]
    },
    rF2: {
        executables: ["rFactor2.exe"],
        title: ["RFAC", "TOR2"]
    },
    raceroom: {
        executables: ["RRRE.exe", "RRRE64.exe"],
        title: ["RACE", "ROOM"]
    },
    ets2: {
        executables: ["eurotrucks2.exe"],
        title: ["EURO", "TS 2"]
    },
    wrc: {
        executables: ["WRC.exe", "wrc.exe"],
        title: [" EA ", "WRC "],
        port: 20777,
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "BRAKETEMP"],
        rightModes: ["STAGE TIME", "BEST TIME", "DISTANCE", "PROGRESS"],
        revLightFlash: {
            pitLimiterSpeed: 'slow',
            shift: { style: 'off', speed: 'fast' },
            maxRpm: { enabled: false, colors: ['all'], speed: 'fast' }
        },
        fallbackMaxRpm: 5000
    },
    lfs: {
        executables: ["LFS.exe"],
        title: ["LFS ", "    "],
        port: 30000,
        forwardPorts: [],
        leftModes: ["SPEED", "RPM", "FUEL", "ENGINETEMP", "OILTEMP", "OILPRESS", "TURBO"],
        rightModes: ["DISPLAY1", "DISPLAY2", "THROTTLE", "BRAKE"],
        fallbackMaxRpm: 5000
    }
};

let globalConfigCache = null;
let configLoadAttempted = false;

function loadGlobalConfig() {
    if (configLoadAttempted) {
        return globalConfigCache;
    }
    
    configLoadAttempted = true;
    const configPath = path.join(path.dirname(process.execPath), GLOBAL_CONFIG_FILENAME);
    
    try {
        if (!fs.existsSync(configPath)) {
            return null;
        }
        
        const fileContent = fs.readFileSync(configPath, 'utf8');
        
        try {
            globalConfigCache = JSON.parse(fileContent);
            console.log(`Loaded global config from ${GLOBAL_CONFIG_FILENAME}`);
            return globalConfigCache;
        } catch (parseError) {
            console.error(`\n========================================`);
            console.error(`ERROR: Failed to parse ${GLOBAL_CONFIG_FILENAME}`);
            console.error(`========================================`);
            console.error(`JSON Parse Error: ${parseError.message}`);
            
            if (parseError.message.includes('position')) {
                const match = parseError.message.match(/position (\d+)/);
                if (match) {
                    const position = parseInt(match[1], 10);
                    const lines = fileContent.substring(0, position).split('\n');
                    const lineNumber = lines.length;
                    const columnNumber = lines[lines.length - 1].length + 1;
                    console.error(`Location: Line ${lineNumber}, Column ${columnNumber}`);
                    
                    const contextStart = Math.max(0, position - 50);
                    const contextEnd = Math.min(fileContent.length, position + 50);
                    const context = fileContent.substring(contextStart, contextEnd);
                    const errorIndex = position - contextStart;
                    
                    console.error(`\nContext around error:`);
                    console.error(`"${context.substring(0, errorIndex)}[ERROR HERE]${context.substring(errorIndex)}"`);
                }
            }
            
            console.error(`\nFalling back to default configuration.`);
            console.error(`========================================\n`);
            return null;
        }
    } catch (readError) {
        console.error(`\n========================================`);
        console.error(`ERROR: Failed to read ${GLOBAL_CONFIG_FILENAME}`);
        console.error(`========================================`);
        console.error(`File Error: ${readError.message}`);
        console.error(`Path: ${configPath}`);
        console.error(`\nFalling back to default configuration.`);
        console.error(`========================================\n`);
        return null;
    }
}

function getClientConfig(clientName, legacyConfigName = null) {
    const defaultConfig = defaultConfigs[clientName] || {};
    
    const globalConfig = loadGlobalConfig();
    if (globalConfig && globalConfig[clientName]) {
        const clientConfig = globalConfig[clientName];
        const mergedConfig = { ...defaultConfig, ...clientConfig };
        console.log(`Found ${clientName} config in global config.json`);
        return mergedConfig;
    }
    
    if (legacyConfigName) {
        try {
            const legacyPath = path.join(path.dirname(process.execPath), legacyConfigName);
            const legacyConfig = require(legacyPath);
            console.log(`Found legacy config: ${legacyConfigName}`);
            return { ...defaultConfig, ...legacyConfig };
        } catch (e) {
            // Legacy config not found, use defaults
        }
    }
    
    console.log(`Using default config for ${clientName}`);
    return defaultConfig;
}

function getDefaultConfig(clientName) {
    return defaultConfigs[clientName] || {};
}

function getAllDefaultConfigs() {
    return { ...defaultConfigs };
}

function getGlobalSettings() {
    const globalConfig = loadGlobalConfig();
    const userGlobal = globalConfig?.global || {};
    return { ...defaultGlobalConfig, ...userGlobal };
}

function getSupportedGames() {
    const globalConfig = loadGlobalConfig();
    const games = [];
    
    for (const [name, defaultCfg] of Object.entries(defaultConfigs)) {
        const userCfg = globalConfig?.[name] || {};
        const executables = userCfg.executables || defaultCfg.executables || [];
        const title = userCfg.title || defaultCfg.title || [name.toUpperCase().slice(0, 4), name.toUpperCase().slice(4, 8) || ""];
        
        games.push({
            name,
            bin: executables.map(e => e.toLowerCase()),
            title
        });
    }
    
    return games;
}

module.exports = {
    getClientConfig,
    getDefaultConfig,
    getAllDefaultConfigs,
    getGlobalSettings,
    getSupportedGames,
    loadGlobalConfig
};
