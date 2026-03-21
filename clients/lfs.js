/*
 * Game client for Live for Speed (OutGauge UDP)
 *
 * Enable in LFS\cfg.txt, e.g.:
 *   OutGauge Mode 1
 *   OutGauge Delay 1
 *   OutGauge IP 127.0.0.1
 *   OutGauge Port 30000
 *
 * OutGauge is only sent in cockpit view (see LFS manual).
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

const UdpListener = require('../lib/udpListener.js');
const AbstractClient = require('../lib/abstractClient.js');
const { getClientConfig } = require('../lib/configLoader.js');

/** Minimum OutGaugePack size without trailing ID (ispackets.h) */
const OUTGAUGE_MIN_LEN = 92;

function readCString(view, offset, maxLen) {
    let s = '';
    for (let i = 0; i < maxLen; i++) {
        const b = view.getUint8(offset + i);
        if (b === 0) break;
        if (b >= 32 && b < 127) s += String.fromCharCode(b);
    }
    return s.trim();
}

function displayText4(str) {
    const t = (str || '').replace(/[^\x20-\x7E]/g, ' ');
    return (t + '    ').substring(0, 4);
}

class LiveForSpeed extends AbstractClient {
    config;
    modeMapping;

    constructor(tmBtLed) {
        if (!tmBtLed) {
            throw 'No TM BT Led lib found.';
        }

        super(tmBtLed);

        this.modeMapping = {
            SPEED: this.showSpeed,
            RPM: this.showRpm,
            FUEL: this.showFuel,
            ENGINETEMP: this.showEngineTemp,
            OILTEMP: this.showOilTemp,
            OILPRESS: this.showOilPress,
            TURBO: this.showTurbo,
            DISPLAY1: this.showDisplay1,
            DISPLAY2: this.showDisplay2,
            THROTTLE: this.showThrottle,
            BRAKE: this.showBrake
        };

        this.config = getClientConfig('lfs', 'lfs.config.js');

        this.setCallbacks({
            onLeftPreviousMode: this.leftPreviousMode,
            onLeftNextMode: this.leftNextMode,
            onRightPreviousMode: this.rightPreviousMode,
            onRightNextMode: this.rightNextMode
        });
        this.setModes(this.config.leftModes, this.config.rightModes);

        this.client = new UdpListener({
            port: this.config.port,
            forwardPorts: this.config.forwardPorts || [],
            bigintEnabled: true
        });
        this.client.on('data', this.parseData);
    }

    startClient = () => {
        console.log('Starting Live for Speed client (OutGauge)...');
        console.log(`Listening on UDP port ${this.config.port}`);
        console.log('Configure OutGauge in LFS\\cfg.txt (IP 127.0.0.1, same port).');
        console.log('Telemetry is sent in cockpit view only.');
        this.client.start();
    };

    stopClient = () => {
        this.client.stop();
    };

    parseData = (message) => {
        const data = this.transformData(message);
        if (!data) return;

        const g = data.gear;
        let displayGear;
        if (g === 0) displayGear = -1;
        else if (g === 1) displayGear = 0;
        else displayGear = g - 1;
        this.tmBtLed.setGear(displayGear);

        const rpm = data.rpm || 0;
        const maxRpm = this.config.fallbackMaxRpm || 7500;
        this.tmBtLed.setRevLights(Math.min(100, Math.max(0, Math.ceil((rpm / maxRpm) * 100))));

        this.tmBtLed.setGearDot(rpm > 200);

        if (this.currentLeftMode < this.leftModes.length) {
            const fn = this.modeMapping[this.leftModes[this.currentLeftMode]];
            if (typeof fn === 'function') fn(data, false);
        }
        if (this.currentRightMode < this.rightModes.length) {
            const fn = this.modeMapping[this.rightModes[this.currentRightMode]];
            if (typeof fn === 'function') fn(data, true);
        }
    };

    showSpeed = (data, onRight) => {
        this.tmBtLed.setSpeed((data.speed || 0) * 3.6, onRight);
    };

    showRpm = (data, onRight) => {
        this.tmBtLed.setRpm(data.rpm || 0, onRight);
    };

    showFuel = (data, onRight) => {
        const f = data.fuel;
        if (f == null || f < 0) {
            this.tmBtLed.setFloat(0, onRight);
            return;
        }
        this.tmBtLed.setFloat(f * 100, onRight);
    };

    showEngineTemp = (data, onRight) => {
        this.tmBtLed.setTemperature(data.engTemp || 0, onRight);
    };

    showOilTemp = (data, onRight) => {
        this.tmBtLed.setTemperature(data.oilTemp || 0, onRight);
    };

    showOilPress = (data, onRight) => {
        this.tmBtLed.setFloat(data.oilPressure || 0, onRight);
    };

    showTurbo = (data, onRight) => {
        this.tmBtLed.setFloat(data.turbo || 0, onRight);
    };

    showDisplay1 = (data, onRight) => {
        this.tmBtLed.updateDisplay(displayText4(data.display1), onRight);
    };

    showDisplay2 = (data, onRight) => {
        this.tmBtLed.updateDisplay(displayText4(data.display2), onRight);
    };

    showThrottle = (data, onRight) => {
        this.tmBtLed.setFloat((data.throttle || 0) * 100, onRight);
    };

    showBrake = (data, onRight) => {
        this.tmBtLed.setFloat((data.brake || 0) * 100, onRight);
    };

    /**
     * LFS OutGaugePack (little-endian). Optional int ID at offset 92 if packet length >= 96.
     */
    transformData = (message) => {
        if (message.length < OUTGAUGE_MIN_LEN) return null;

        const view = new DataView(message.buffer, message.byteOffset, message.byteLength);

        return {
            time: view.getUint32(0, true),
            car: readCString(view, 4, 4),
            flags: view.getUint16(8, true),
            gear: view.getUint8(10),
            plid: view.getUint8(11),
            speed: view.getFloat32(12, true),
            rpm: view.getFloat32(16, true),
            turbo: view.getFloat32(20, true),
            engTemp: view.getFloat32(24, true),
            fuel: view.getFloat32(28, true),
            oilPressure: view.getFloat32(32, true),
            oilTemp: view.getFloat32(36, true),
            dashLights: view.getUint32(40, true),
            showLights: view.getUint32(44, true),
            throttle: view.getFloat32(48, true),
            brake: view.getFloat32(52, true),
            clutch: view.getFloat32(56, true),
            display1: readCString(view, 60, 16),
            display2: readCString(view, 76, 16)
        };
    };
}

module.exports = LiveForSpeed;
