/*
 * Basic client functions
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const ERROR_LOG_INTERVAL_MS = 5000;

class AbstractClient {
    currentLeftMode = 0;
    currentRightMode = 0;

    client;
    callbacks;

    lastErrorLog = 0;
    suppressedErrors = 0;

    constructor(tmBtLed) {        
        this.setTmBtLed(tmBtLed);
    }

    /**
     * Shows socket failures (e.g. port already in use) on the device instead of crashing.
     */
    watchUdpListener = (listener) => {
        listener.on("listenerError", this.handleListenerError);
        return listener;
    }

    handleListenerError = (err) => {
        const portBusy = err && err.code === 'EADDRINUSE';
        this.tmBtLed.showTemporary(portBusy ? "PORT" : " UDP", portBusy ? "BUSY" : " ERR", 10000);
    }

    /**
     * Wraps a periodic or event callback so one bad telemetry frame is logged (rate limited)
     * instead of becoming an uncaught exception.
     */
    guard = (fn) => (...args) => {
        try {
            return fn(...args);
        } catch (err) {
            const now = Date.now();
            if (now - this.lastErrorLog < ERROR_LOG_INTERVAL_MS) {
                this.suppressedErrors++;
                return;
            }
            const suppressed = this.suppressedErrors > 0 ? ` (${this.suppressedErrors} similar errors suppressed)` : "";
            console.error(`${this.constructor.name} client error${suppressed}:`, err);
            this.lastErrorLog = now;
            this.suppressedErrors = 0;
        }
    }

    setCallbacks = callbacks => {
        this.tmBtLed.setCallbacks(callbacks);
    }

    setTmBtLed = (tmBtLed) => {
        this.tmBtLed = tmBtLed;
    }

    startClient = () => {
        // NO op
    }

    stopClient = () => {
        // NO op
    }

    showGameTitle = (title) => {
        this.tmBtLed.setLeftDisplay(title.substr(0,4).toUpperCase());
        this.tmBtLed.setRightDisplay(title.substr(4,4).toUpperCase()); 
    }

    setModes = (leftModes, rightModes) => {
        this.leftModes = leftModes;
        this.rightModes = rightModes; 
    }

    leftPreviousMode = () => {
        if (this.leftModes.length === 0) {
            console.error("No left modes")
            return;
        }
        if (this.currentLeftMode === 0) {
          this.currentLeftMode = this.leftModes.length - 1;
        } else {
          this.currentLeftMode--;
        }
        this.tmBtLed.showTemporaryLeft(this.leftModes[this.currentLeftMode]);
        return this.currentLeftMode;
    }

    leftNextMode = () => {
        if (this.leftModes.length === 0) {
            console.error("No left modes")
            return;
        }
        if (this.currentLeftMode === this.leftModes.length - 1) {
            this.currentLeftMode = 0;
        } else {
            this.currentLeftMode++;
        }
        this.tmBtLed.showTemporaryLeft(this.leftModes[this.currentLeftMode]);
        return this.currentLeftMode;    
    }

    rightPreviousMode = () => {
        if (this.rightModes.length === 0) {
            console.error("No right modes")
            return;
        }
        if (this.currentRightMode === 0) {
            this.currentRightMode = this.rightModes.length - 1;
        } else {
            this.currentRightMode--;
        }
        this.tmBtLed.showTemporaryRight(this.rightModes[this.currentRightMode]);
        return this.currentRightMode;
    }

    rightNextMode = () => {
        if (this.rightModes.length === 0) {
            console.error("No right modes");
            return;
        }
        if (this.currentRightMode === this.rightModes.length - 1) {
            this.currentRightMode = 0;
        } else {
            this.currentRightMode++;
        }
        this.tmBtLed.showTemporaryRight(this.rightModes[this.currentRightMode]);
        return this.currentRightMode;    
    }
}

module.exports = AbstractClient;