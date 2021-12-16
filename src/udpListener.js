/*
 * Basic UPD listener class
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
/**
 *
 */
class UdpListener extends events_1.EventEmitter {
    constructor(opts = {}) {
        super();
        const { port = DEFAULT_PORT, bigintEnabled = BIGINT_ENABLED } = opts;
        this.port = port;
        this.bigintEnabled = bigintEnabled;
        this.client = dgram.createSocket('udp4');
    }
    /**
     *
     * @param {Buffer} message
     */
    parseMessage(message) {

        this.emit("data", message);
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
        return this.client.close(() => {
            console.log(`UDP Client closed 🏁`);
            this.client = undefined;
        });
    }
}
exports.UdpListener = UdpListener;
