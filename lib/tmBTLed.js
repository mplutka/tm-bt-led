/*
 * Main library to drive the TM BT Led: BLE transport on top of the display state
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

const fs = require("fs");
const { TmBTLedDisplay, FRAME_BYTES } = require('./display.js');
const { getGlobalSettings, resolveAppPath } = require('./configLoader.js');
const { toValidBleInterval, intervalToFps, resolveTargetInterval, clampQueueDepth } = require('./bleTiming.js');
const { installSignalHandlers, onShutdown, isShuttingDown } = require('./shutdown.js');
const { isLinux, configureHciEnvironment } = require('./platform.js');

const ADDITIONAL_USB_VID_PID_ENV = "BLUETOOTH_HCI_SOCKET_ADDITIONAL_VID_PIDS";
const DUMP_EXT = '.dump';
const DEFAULT_OUTPUT_HANDLE = 58;
const HID_SERVICE_UUID = "1812";
const HID_REPORT_UUID = "2a4d";
const DISCONNECT_TIMEOUT_MS = 1000;
const MAX_PERFORMANCE_RETRIES = 3;
const PERFORMANCE_RETRY_DELAY_MS = 200;

function parseVidPidValue(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return null;
        }
        const parsed = Number.parseInt(trimmed, 0);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
    }
    return null;
}

function normalizeAdditionalUsbVidPids(entries) {
    if (!Array.isArray(entries)) {
        return [];
    }
    return entries
        .map((entry) => {
            if (!entry || typeof entry !== "object") {
                return null;
            }
            const vid = parseVidPidValue(entry.vid);
            const pid = parseVidPidValue(entry.pid);
            if (!Number.isInteger(vid) || !Number.isInteger(pid)) {
                return null;
            }
            return { vid, pid };
        })
        .filter(Boolean);
}

/**
 * Picks the HID report characteristic the display frame is written to. The default (58) is the
 * output report of known devices; other layouts fall back to the last writable report.
 */
function resolveOutputHandle(meta, override) {
    const overrideHandle = parseVidPidValue(override);
    if (Number.isInteger(overrideHandle) && overrideHandle > 0) {
        return overrideHandle;
    }
    const reports = (meta?.characteristics?.[HID_SERVICE_UUID] || [])
        .filter(c => c.uuid === HID_REPORT_UUID && (c.propsDecoded || []).includes("writeWithoutResponse"));
    if (reports.length === 0 || reports.some(c => c.valueHandle === DEFAULT_OUTPUT_HANDLE)) {
        return DEFAULT_OUTPUT_HANDLE;
    }
    return reports[reports.length - 1].valueHandle;
}

// Literal paths so pkg bundles the native binding for every architecture.
function loadUsbBinding() {
    switch (process.arch) {
        case "arm64":
            return require("usb/prebuilds/win32-arm64/node.napi.node");
        case "ia32":
            return require("usb/prebuilds/win32-ia32/node.napi.node");
        default:
            return require("usb/prebuilds/win32-x64/node.napi.node");
    }
}

let nobleInstance = null;

function getNoble() {
    if (nobleInstance) {
        return nobleInstance;
    }
    if (isLinux()) {
        configureHciEnvironment(process.env, getGlobalSettings());
        console.log(`Using Bluetooth adapter hci${process.env.NOBLE_HCI_DEVICE_ID} (HCI user channel)`);
    } else {
        const additionalUsbVidPids = normalizeAdditionalUsbVidPids(getGlobalSettings().additionalUsbVidPids);
        if (additionalUsbVidPids.length > 0) {
            process.env[ADDITIONAL_USB_VID_PID_ENV] = JSON.stringify(additionalUsbVidPids);
            console.log("Added support for additional sticks", process.env[ADDITIONAL_USB_VID_PID_ENV]);
        }
        loadUsbBinding();
    }
    const NobleMain = require('@abandonware/noble/lib/noble');
    const NobleBinding = require("@abandonware/noble/lib/hci-socket/bindings");
    nobleInstance = new NobleMain(NobleBinding);
    return nobleInstance;
}

function getDumpPath(uuid) {
    return resolveAppPath(uuid + DUMP_EXT);
}

const startTime = Date.now();
process.on('exit', () => {
    console.log("Ran for " + ((Date.now() - startTime) / 1000 / 60).toFixed(1) + " minutes");
});

/**
 * Fires the callback on a fixed period with sub-millisecond accuracy without busy-waiting the
 * whole period: sleeps with setTimeout and only spins (via setImmediate) for the last part.
 * The spin window adapts to the observed timer lateness (Windows timers can be ~15.6ms coarse).
 */
class HighResolutionTimer {
    static MIN_SPIN_MS = 1;
    // A coarse OS timer then shows up as tick jitter instead of a busy loop.
    static MAX_SPIN_MS = 3;

    constructor(callback, intervalMs) {
        this.callback = callback;
        this.intervalNs = BigInt(Math.round(intervalMs * 1e6));
        this.running = false;
        this.nextTickTime = BigInt(0);
        this.timeoutId = null;
        this.immediateId = null;
        this.skippedFrames = 0;
        this.timerLatenessMs = 2;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.nextTickTime = process.hrtime.bigint() + this.intervalNs;
        this._schedule();
    }

    stop() {
        this.running = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        if (this.immediateId) {
            clearImmediate(this.immediateId);
            this.immediateId = null;
        }
    }

    setInterval(intervalMs) {
        this.intervalNs = BigInt(Math.round(intervalMs * 1e6));
    }

    get intervalMs() {
        return Number(this.intervalNs) / 1e6;
    }

    _spinWindowMs() {
        const spin = Math.max(HighResolutionTimer.MIN_SPIN_MS, Math.min(HighResolutionTimer.MAX_SPIN_MS, this.timerLatenessMs + 1));
        return Math.min(this.intervalMs, spin);
    }

    _schedule() {
        if (!this.running) return;

        const remainingMs = Number(this.nextTickTime - process.hrtime.bigint()) / 1e6;
        const sleepMs = remainingMs - this._spinWindowMs();

        if (sleepMs >= 1) {
            const requested = Math.floor(sleepMs);
            const sleptFrom = process.hrtime.bigint();
            this.timeoutId = setTimeout(() => {
                this.timeoutId = null;
                const sleptMs = Number(process.hrtime.bigint() - sleptFrom) / 1e6;
                const lateness = Math.max(0, sleptMs - requested);
                this.timerLatenessMs = this.timerLatenessMs * 0.8 + lateness * 0.2;
                this._schedule();
            }, requested);
            return;
        }

        this.immediateId = setImmediate(() => {
            this.immediateId = null;
            if (!this.running) return;
            const now = process.hrtime.bigint();
            if (now >= this.nextTickTime) {
                this._tick(now);
            }
            this._schedule();
        });
    }

    _tick(now) {
        const behindMs = Number(now - this.nextTickTime) / 1e6;
        if (behindMs > this.intervalMs * 2) {
            this.skippedFrames++;
            this.nextTickTime = now + this.intervalNs;
        } else {
            this.nextTickTime += this.intervalNs;
        }

        try {
            this.callback();
        } catch (e) {
            console.error('Timer callback error:', e);
        }
    }
}

/**
 * Limits the number of frames handed to the GATT queue that have not been dispatched yet.
 * Completion is signalled by noble's handleWrite event; a watchdog releases stuck slots.
 */
class WriteQueue {
    static STUCK_TIMEOUT_MS = 1000;

    constructor(maxPending = 2) {
        this.maxPending = maxPending;
        this.reset();
    }

    canWrite(now = Date.now()) {
        if (this.pendingWrites > 0 && now - this.lastProgressTime > WriteQueue.STUCK_TIMEOUT_MS) {
            this.recordError();
            this.pendingWrites = 0;
        }
        if (this.backoffMs > 0) {
            if (now - this.lastBackoffTime < this.backoffMs) {
                return false;
            }
            this.backoffMs = Math.max(0, this.backoffMs - 5);
        }
        return this.pendingWrites < this.maxPending;
    }

    startWrite(now = Date.now()) {
        if (this.pendingWrites === 0) {
            this.lastProgressTime = now;
        }
        this.pendingWrites++;
        this.totalWrites++;
        this.maxPendingSeen = Math.max(this.maxPendingSeen, this.pendingWrites);
        this.writeStartTimes.push(process.hrtime.bigint());
    }

    endWrite() {
        if (this.pendingWrites === 0) {
            return;
        }
        this.pendingWrites--;
        this.lastProgressTime = Date.now();
        const started = this.writeStartTimes.shift();
        if (started) {
            this.writeLatencies.push(Number(process.hrtime.bigint() - started) / 1e6);
            if (this.writeLatencies.length > 100) {
                this.writeLatencies.shift();
            }
        }
        this.consecutiveErrors = 0;
        if (this.backoffMs > 0) {
            this.backoffMs = Math.max(0, this.backoffMs - 2);
        }
    }

    recordError() {
        this.errorCount++;
        this.consecutiveErrors++;
        this.backoffEvents++;
        this.lastBackoffTime = Date.now();
        this.backoffMs = Math.min(100, this.consecutiveErrors * 10);
        this.pendingWrites = Math.max(0, this.pendingWrites - 1);
        this.writeStartTimes.shift();
    }

    dropWrite() {
        this.droppedWrites++;
    }

    getStats() {
        const n = this.writeLatencies.length;
        const avgLatency = n > 0 ? this.writeLatencies.reduce((a, b) => a + b, 0) / n : 0;
        const minLatency = n > 0 ? Math.min(...this.writeLatencies) : 0;
        const maxLatency = n > 0 ? Math.max(...this.writeLatencies) : 0;
        return {
            pending: this.pendingWrites,
            maxPending: this.maxPendingSeen,
            total: this.totalWrites,
            dropped: this.droppedWrites,
            errors: this.errorCount,
            backoffMs: this.backoffMs,
            backoffEvents: this.backoffEvents,
            avgLatencyMs: avgLatency.toFixed(2),
            minLatencyMs: minLatency.toFixed(2),
            maxLatencyMs: maxLatency.toFixed(2),
            queueDepth: this.maxPending
        };
    }

    resetWindow() {
        this.totalWrites = 0;
        this.droppedWrites = 0;
        this.maxPendingSeen = this.pendingWrites;
        this.backoffEvents = 0;
    }

    reset() {
        this.pendingWrites = 0;
        this.droppedWrites = 0;
        this.totalWrites = 0;
        this.errorCount = 0;
        this.consecutiveErrors = 0;
        this.backoffMs = 0;
        this.lastBackoffTime = 0;
        this.backoffEvents = 0;
        this.maxPendingSeen = 0;
        this.lastProgressTime = 0;
        this.writeLatencies = [];
        this.writeStartTimes = [];
    }
}

class TmBTLed extends TmBTLedDisplay {

    static EXT = DUMP_EXT;

    initCallback;
    options;
    noble;
    updateInterval = 250;
    targetInterval;
    intervalId = null;
    hrTimer = null;
    peripheral = null;
    connecting = false;
    hasConnected = false;
    linkMode = null;
    performanceRetries = 0;
    outputHandle = DEFAULT_OUTPUT_HANDLE;
    writeQueue;
    sentBuffer = Buffer.alloc(FRAME_BYTES);
    lastStatsTime = 0;
    statsIntervalMs;
    useHighResTimer;
    discoveredLogged = false;
    dumpPathCache = new Map();

    constructor(initCallback, options = {}) {
        super({ metric: options.metric, imperial: options.imperial });

        this.initCallback = initCallback;
        this.options = options;
        this.targetInterval = resolveTargetInterval(options);
        this.writeQueue = new WriteQueue(clampQueueDepth(options.queueDepth));
        this.statsIntervalMs = options.debug ? 2000 : 10000;
        this.useHighResTimer = options.legacyTimer !== true;

        this.noble = getNoble();
        onShutdown(this.shutdown);
        this.initNoble();
    }

    initNoble = () => {
        const noble = this.noble;

        noble.on('stateChange', (state) => {
          if (state === 'poweredOn') {
            installSignalHandlers();
            if (!this.peripheral && !this.connecting) {
              console.log("Starting scan...");
              this._startScanning();
            }
          } else {
            console.warn(`Bluetooth adapter state: ${state}`);
            noble.stopScanning();
          }
        });

        noble.on('discover', this._onDiscover);
        noble.on('connectionParameterUpdateRequest', this._onConnectionParameterUpdateRequest);
        noble.on('connectionUpdateCompleted', this._onConnectionUpdateCompleted);
    }

    _startScanning = () => {
        if (isShuttingDown()) {
          return;
        }
        this.noble.startScanning([], true);
    }

    _findDumpPath = (uuid) => {
        if (!this.dumpPathCache.has(uuid)) {
          const dumpPath = getDumpPath(uuid);
          this.dumpPathCache.set(uuid, fs.existsSync(dumpPath) ? dumpPath : null);
        }
        return this.dumpPathCache.get(uuid);
    }

    _onDiscover = (peripheral) => {
        if (!this.discoveredLogged) {
          console.log("Discovering devices. Please press both pair buttons now...");
          this.discoveredLogged = true;
        }
        if (this.peripheral || this.connecting || isShuttingDown()) {
          return;
        }
        const dumpPath = this._findDumpPath(peripheral.uuid);
        if (!dumpPath) {
          return;
        }
        console.log(` -- Found device config ${peripheral.uuid}`);
        this.quickConnect(peripheral, dumpPath);
    }

    _onConnectionParameterUpdateRequest = (minInterval, maxInterval) => {
        console.log(`Connection parameter update requested: ${minInterval}-${maxInterval}ms (${intervalToFps(maxInterval)} FPS)`);
        this._applyConnectionInterval(maxInterval);
    }

    _onConnectionUpdateCompleted = (status, handle, interval, latency, supervisionTimeout) => {
        if (status === 0) {
          console.log(`Connection updated: ${interval}ms (${intervalToFps(interval)} FPS), latency=${latency}, timeout=${supervisionTimeout}ms`);
          this._applyConnectionInterval(interval);
        } else {
          console.warn(`Connection parameter update failed with status ${status}`);
        }
        this._retryPerformanceMode(status === 0 ? interval : null);
    }

    // The display's own slow-interval request can overtake ours right after connecting.
    _retryPerformanceMode = (interval) => {
        if (this.linkMode !== 'performance' || !this.peripheral) {
          return;
        }
        const target = toValidBleInterval(this.targetInterval);
        if (interval !== null && interval <= target) {
          return;
        }
        if (this.performanceRetries >= MAX_PERFORMANCE_RETRIES) {
          return;
        }
        this.performanceRetries++;
        setTimeout(() => this.setPerformanceMode(), PERFORMANCE_RETRY_DELAY_MS);
    }

    _applyConnectionInterval = (interval) => {
        this.updateInterval = interval;
        if (!this.peripheral) {
          return;
        }
        if (this.hrTimer) {
          this.hrTimer.setInterval(interval);
        } else {
          this.startLoop();
        }
    }

    quickConnect = (p, dumpPath) => {
        this.connecting = true;
        this.noble.stopScanning();

        const onDisconnect = () => this._onDisconnect(p, onWriteDone);
        const onWriteDone = () => this.writeQueue.endWrite();

        p.connect((error) => {
            if (error) {
              console.log(`Connect error: ${error}`);
              this.connecting = false;
              this._startScanning();
              return;
            }
            p.once('disconnect', onDisconnect);
            // The dump already holds every service and handle; a GATT discovery would only add
            // several seconds at the slow interval the display asks for right after connecting.
            this._setupConnection(p, dumpPath, onWriteDone);
        });
    }

    _setupConnection = (p, dumpPath, onWriteDone) => {
        let meta;
        try {
          meta = this.loadData(dumpPath);
        } catch (e) {
          console.error(`Could not read device config ${dumpPath}: ${e.message}`);
          this.connecting = false;
          p.disconnect();
          return;
        }
        const [report1] = this.setData(p, meta);
        this.outputHandle = resolveOutputHandle(meta, this.options.outputHandle ?? getGlobalSettings().outputHandle);

        if (!report1) {
            console.log('Warning - no event characteristic found. Mode buttons won\'t work.');
        } else {
            report1.removeListener("data", this.handleEvent);
            report1.on("data", this.handleEvent);
        }

        p.removeListener(`handleWrite${this.outputHandle}`, onWriteDone);
        p.on(`handleWrite${this.outputHandle}`, onWriteDone);

        this.peripheral = p;
        this.connecting = false;
        this.performanceRetries = 0;
        this.startLoop();

        if (this.hasConnected) {
          console.log("Reconnected to TM BT LED.");
          if (this.linkMode === 'performance') {
            this.setPerformanceMode();
          } else if (this.linkMode === 'powersave') {
            this.setPowerSaveMode();
          }
          return;
        }

        this.hasConnected = true;
        if (this.initCallback) {
          console.log("Init done. Waiting for data...");
          this.initCallback();
        }

        if (!this.message) {
          this.showTemporary("NO  GAME");
        }
    }

    _onDisconnect = (p, onWriteDone) => {
        p.removeListener(`handleWrite${this.outputHandle}`, onWriteDone);
        if (this.peripheral !== p) {
          if (this.connecting && !isShuttingDown()) {
            console.warn("TM BT LED disconnected during setup. Scanning again...");
            this.connecting = false;
            this._startScanning();
          }
          return;
        }
        this.peripheral = null;
        this.connecting = false;
        this.updateInterval = 250;
        this.stopLoop();
        this.writeQueue.reset();
        if (isShuttingDown()) {
          return;
        }
        console.warn("TM BT LED disconnected. Waiting for it to come back (press both pair buttons if it does not reconnect)...");
        this._startScanning();
    }

    shutdown = () => {
        this.stopLoop();
        this.dispose();
        try {
          this.noble.stopScanning();
        } catch (e) {
          // adapter already gone
        }
        const p = this.peripheral;
        if (!p || p.state !== 'connected') {
          return Promise.resolve();
        }
        return new Promise((resolve) => {
          const timeout = setTimeout(resolve, DISCONNECT_TIMEOUT_MS);
          p.once('disconnect', () => {
            clearTimeout(timeout);
            resolve();
          });
          try {
            p.disconnect();
          } catch (e) {
            clearTimeout(timeout);
            resolve();
          }
        });
    }

    setPerformanceMode = () => {
        this.linkMode = 'performance';
        if (!this.peripheral) {
            return;
        }
        const interval = toValidBleInterval(this.targetInterval);
        console.log(`Switching to performance mode: requesting ${interval}ms (${intervalToFps(interval)} FPS)`);
        this.peripheral.connUpdateLe(interval, interval, 0, 3000);
    }

    setPowerSaveMode = () => {
        this.linkMode = 'powersave';
        if (!this.peripheral) {
            return;
        }
        console.log(`Switching to power save mode: 125-250ms (${intervalToFps(250)}-${intervalToFps(125)} FPS)`);
        this.peripheral.connUpdateLe(125, 250, 0, 3000);
    }

    setWriteQueueDepth = (depth) => {
        this.writeQueue.maxPending = clampQueueDepth(depth);
        console.log(`Write queue depth set to ${this.writeQueue.maxPending}`);
    }

    static getValidIntervals() {
        const intervals = [];
        for (let i = 6; i <= 80; i++) {
            const ms = i * 1.25;
            intervals.push({ ms, fps: parseFloat(intervalToFps(ms)) });
        }
        return intervals;
    }

    startLoop = () => {
        this.stopLoop();

        this.writeQueue.reset();
        this.sentBuffer.fill(0);
        this.lastStatsTime = Date.now();

        const fps = intervalToFps(this.updateInterval);

        if (this.useHighResTimer) {
          console.log(`Starting high-resolution loop: ${this.updateInterval}ms interval (${fps} FPS)`);
          console.log(`Write queue depth: ${this.writeQueue.maxPending}, Target: ${this.targetInterval}ms (${intervalToFps(this.targetInterval)} FPS)`);
          this.hrTimer = new HighResolutionTimer(this._processFrame, this.updateInterval);
          this.hrTimer.start();
        } else {
          console.log(`Starting legacy setInterval loop: ${this.updateInterval}ms interval (${fps} FPS)`);
          this.intervalId = setInterval(this._processFrame, this.updateInterval);
        }
    }

    _processFrame = () => {
        if (!this.peripheral) {
          return;
        }

        this._logStats();

        const frame = this.getFrame();

        if (this.sentBuffer.equals(frame)) {
          return;
        }

        if (!this.writeQueue.canWrite()) {
          this.writeQueue.dropWrite();
          return;
        }

        this.writeQueue.startWrite();
        const writeBuffer = Buffer.from(frame);

        try {
          this.peripheral.writeHandle(this.outputHandle, writeBuffer, true);
          writeBuffer.copy(this.sentBuffer);
        } catch (err) {
          this.writeQueue.recordError();
          console.warn(`BLE write error (backoff ${this.writeQueue.backoffMs}ms): ${err?.message || err}`);
        }
    }

    _logStats = () => {
        const now = Date.now();
        const elapsed = now - this.lastStatsTime;
        if (elapsed < this.statsIntervalMs) {
          return;
        }
        const stats = this.writeQueue.getStats();
        const timerStats = this.hrTimer ? {
          skipped: this.hrTimer.skippedFrames,
          intervalMs: this.hrTimer.intervalMs
        } : { skipped: 0, intervalMs: this.updateInterval };

        const actualFps = (stats.total / (elapsed / 1000)).toFixed(1);
        const targetFps = intervalToFps(timerStats.intervalMs);
        const efficiency = stats.total > 0 ? ((stats.total / (stats.total + stats.dropped)) * 100).toFixed(1) : "100.0";

        if (this.options.debug) {
          console.log(`\n┌─── BLE Debug Stats (${(elapsed/1000).toFixed(1)}s window) ───┐`);
          console.log(`│ Timing`);
          console.log(`│   Interval:    ${timerStats.intervalMs}ms`);
          console.log(`│   Target FPS:  ${targetFps}`);
          console.log(`│   Actual FPS:  ${actualFps}`);
          console.log(`│   Efficiency:  ${efficiency}%`);
          if (this.hrTimer) {
            console.log(`│   Timer late:  ${this.hrTimer.timerLatenessMs.toFixed(2)}ms`);
          }
          console.log(`│ Queue (depth: ${stats.queueDepth})`);
          console.log(`│   Pending:     ${stats.pending} / ${stats.queueDepth}`);
          console.log(`│   Max seen:    ${stats.maxPending}`);
          console.log(`│   Writes:      ${stats.total}`);
          console.log(`│   Dropped:     ${stats.dropped}`);
          console.log(`│ Errors`);
          console.log(`│   Count:       ${stats.errors}`);
          console.log(`│   Backoffs:    ${stats.backoffEvents}`);
          console.log(`│   Current:     ${stats.backoffMs}ms`);
          console.log(`│ Dispatch latency (ms)`);
          console.log(`│   Avg:         ${stats.avgLatencyMs}`);
          console.log(`│   Min/Max:     ${stats.minLatencyMs} / ${stats.maxLatencyMs}`);
          console.log(`│ Frames`);
          console.log(`│   Skipped:     ${timerStats.skipped}`);
          console.log(`│ Buffer`);
          console.log(`│   Size:        ${this.buffer.length} bytes`);
          console.log(`│   Handle:      ${this.outputHandle}`);
          console.log(`└────────────────────────────────┘\n`);
        } else if (stats.dropped > 0 || stats.errors > 0 || timerStats.skipped > 0) {
          console.log(`BLE: ${actualFps}/${targetFps} FPS (${efficiency}%), Drop: ${stats.dropped}, Err: ${stats.errors}, Skip: ${timerStats.skipped}`);
        }

        this.lastStatsTime = now;
        if (this.hrTimer) {
          this.hrTimer.skippedFrames = 0;
        }
        this.writeQueue.resetWindow();
    }

    stopLoop = () => {
        if (this.hrTimer) {
          this.hrTimer.stop();
          this.hrTimer = null;
        }
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
    }

    loadData = (dumpPath) => {
      return JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
    };

    setData = (peripheral, meta) => {
      // addServices returns an array of initialized service objects
      const services = this.noble.addServices(peripheral.uuid, meta.services);

      console.log('Initializing services...');
      let foundCharacteristics = [null, null, null, null];

      for (const i in services) {
        const service = services[i];
        if (service.uuid !== HID_SERVICE_UUID) {
          continue;
        }
        const charas = meta.characteristics[service.uuid];
        const characteristics = this.noble.addCharacteristics(peripheral.uuid, service.uuid, charas);
        let characteristicCount = 0;
        for (const j in characteristics) {
          const characteristic = characteristics[j];
          if (characteristic.uuid !== HID_REPORT_UUID) {
            continue;
          }
          foundCharacteristics[characteristicCount++] = characteristic;
        }
      }
      return foundCharacteristics;
    };
}


class Setup {
  constructor() {
      this.noble = getNoble();
      this.initNoble();
  }

  initNoble = () => {
    const noble = this.noble;

    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {
        console.log("Starting scan...");
        noble.startScanning();
      } else {
        console.warn(`Bluetooth adapter state: ${state}`);
        noble.stopScanning();
      }
    });

    let discovered = false;
    noble.on('discover', (peripheral) => {
      if (!discovered) {
        console.log("Discovering devices. Please press both pair buttons now...");
        discovered = true;
      }

      if (peripheral.uuid.match(/^0008.*/)) {
        noble.stopScanning();
        console.log("Found device ", peripheral.uuid, ". Writing dump..." );
        this.writeDump(peripheral.uuid);
      }
    });
  }

  writeDump = (uuid) => {
    const templatePath = getDumpPath('0008d3aabbcc');
    fs.readFile(templatePath, 'utf8' , (err, data) => {
      if (err) {
        console.error(`Template file ${templatePath} not found. Please create dump manually.`, err);
        process.exit(1);
        return;
      }
      
      data = data.replace("0008d3aabbcc", uuid).
        replace("00:08:d3:aa:bb:cc", "00:08:d3:aa:bb:cc".split(":").map((c,i) => (uuid[(i*2)] + uuid[(i*2)+1])).join(":"));
      
      const dumpPath = getDumpPath(uuid);
      fs.writeFile(dumpPath, data, err => {
        if (err) {
          console.error(`Couldn't write ${dumpPath}. Please create dump manually.`, err);
          process.exit(1);
          return
        }
        console.log(isLinux()
          ? `Dump written to ${dumpPath}. Run "node ../lib/launcher.js --test" for a demo or "node ../lib/launcher.js" for autodetect game mode.`
          : `Dump written to ${dumpPath}. Run test.bat for a demo or run.bat for autodetect game mode.`);
        process.exit(0);
      })            
    })
  } 
}

module.exports = {
  TmBTLed, 
  Setup,
  HighResolutionTimer,
  WriteQueue,
  normalizeAdditionalUsbVidPids,
  resolveOutputHandle
};
