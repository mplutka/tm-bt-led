/*
 * Basic UDP listener class with optional port forwarding
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const dgram = __importStar(require("dgram"));
const events_1 = require("events");
const DEFAULT_PORT = 20777;
exports.DEFAULT_PORT = DEFAULT_PORT;
const BIGINT_ENABLED = true;
const HANDLER_ERROR_LOG_INTERVAL_MS = 5000;

function describeSocketError(err, port) {
    if (err && err.code === 'EADDRINUSE') {
        return `UDP port ${port} is already in use by another program (e.g. SimHub or a second tm-bt-led). ` +
            `Close it, or let it forward telemetry to a different port and use "forwardPorts" here instead.`;
    }
    if (err && err.code === 'EACCES') {
        return `Access to UDP port ${port} denied. Try another port or check firewall/security software.`;
    }
    return `UDP socket error on port ${port}: ${err && err.message ? err.message : err}`;
}

/**
 * UDP Listener with optional forwarding to additional ports.
 * Emits "data" for each packet and "listenerError" (never "error") when the socket fails.
 */
class UdpListener extends events_1.EventEmitter {
    constructor(opts = {}) {
        super();
        const { port = DEFAULT_PORT, bigintEnabled = BIGINT_ENABLED, forwardPorts = [], reuseAddr = false } = opts;
        this.port = port;
        this.bigintEnabled = bigintEnabled;
        this.forwardPorts = Array.isArray(forwardPorts) ? forwardPorts : [];
        this.lastHandlerErrorLog = 0;
        this.suppressedHandlerErrors = 0;
        this.client = dgram.createSocket({ type: 'udp4', reuseAddr: !!reuseAddr });
        this.client.on('error', (err) => {
            console.error(describeSocketError(err, this.port));
            this.emit('listenerError', err);
        });
    }
    /**
     * Forward message to configured ports
     * @param {Buffer} message
     */
    forwardMessage(message) {
        if (!this.client || this.forwardPorts.length === 0) {
            return;
        }
        this.forwardPorts.forEach(port => {
            this.client.send(message, port, '127.0.0.1', (err) => {
                if (err) {
                    console.error(`Error forwarding to port ${port}:`, err);
                }
            });
        });
    }
    /**
     * Parse and emit message, also forward if configured
     * @param {Buffer} message
     */
    parseMessage(message) {
        this.forwardMessage(message);
        try {
            this.emit("data", message);
        } catch (err) {
            this.logHandlerError(err);
        }
    }
    /**
     * A malformed packet must not take down the process; log at most every few seconds.
     * @param {Error} err
     */
    logHandlerError(err) {
        const now = Date.now();
        if (now - this.lastHandlerErrorLog < HANDLER_ERROR_LOG_INTERVAL_MS) {
            this.suppressedHandlerErrors++;
            return;
        }
        const suppressed = this.suppressedHandlerErrors > 0 ? ` (${this.suppressedHandlerErrors} similar errors suppressed)` : '';
        console.error(`Error while processing telemetry packet on port ${this.port}${suppressed}:`, err);
        this.lastHandlerErrorLog = now;
        this.suppressedHandlerErrors = 0;
    }
    /**
     * Method to start listening for packets
     */
    start() {
        if (!this.client) {
            return;
        }
        this.client.on('listening', () => {
            if (!this.client) {
                return;
            }
            const address = this.client.address();
            console.log(`UDP Client listening on ${address.address}:${address.port} 🏎`);
            if (this.forwardPorts.length > 0) {
                console.log(`Forwarding to ports: ${this.forwardPorts.join(', ')}`);
            }
            this.client.setBroadcast(true);
        });
        this.client.on('message', (m) => this.parseMessage(m));
        this.client.bind(this.port);
    }
    /**
     * Method to close the client
     */
    stop() {
        if (!this.client) {
            return;
        }
        const client = this.client;
        this.client = undefined;
        try {
            client.close(() => {
                console.log(`UDP Client closed 🏁`);
            });
        } catch (err) {
            // already closed after a socket error
        }
    }
}
module.exports = UdpListener;
module.exports.DEFAULT_PORT = DEFAULT_PORT;
module.exports.describeSocketError = describeSocketError;
