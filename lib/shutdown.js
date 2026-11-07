/*
 * Graceful shutdown: runs registered cleanup handlers (stop game client, disconnect BLE)
 * before the process exits, so the USB/HCI link is not left half-open.
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

const SHUTDOWN_TIMEOUT_MS = 3000;
// SIGBREAK = Ctrl+Break, SIGHUP = console window closed (Windows)
const SIGNALS = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];

const handlers = [];
let signalsInstalled = false;
let shuttingDown = false;

function onShutdown(handler) {
    handlers.push(handler);
    return () => {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
            handlers.splice(index, 1);
        }
    };
}

function isShuttingDown() {
    return shuttingDown;
}

async function shutdown(reason, exitCode = 0) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    console.log(`\nShutting down (${reason})...`);

    const forceExit = setTimeout(() => {
        console.warn("Cleanup timed out, exiting.");
        process.exit(exitCode);
    }, SHUTDOWN_TIMEOUT_MS);

    for (const handler of handlers.slice().reverse()) {
        try {
            await handler(reason);
        } catch (e) {
            console.error("Error during shutdown:", e?.message || e);
        }
    }

    clearTimeout(forceExit);
    process.exit(exitCode);
}

/**
 * Must be called after noble's HCI bindings are initialised: noble exits immediately on SIGINT
 * unless its own listener is not the last one registered.
 */
function installSignalHandlers() {
    if (signalsInstalled) {
        return;
    }
    signalsInstalled = true;
    for (const signal of SIGNALS) {
        try {
            process.on(signal, () => shutdown(signal));
        } catch (e) {
            // signal not supported on this platform
        }
    }
}

module.exports = {
    onShutdown,
    shutdown,
    isShuttingDown,
    installSignalHandlers
};
