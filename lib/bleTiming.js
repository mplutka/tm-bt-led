/*
 * BLE connection interval helpers
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

const BLE_INTERVAL_STEP_MS = 1.25;
const BLE_MIN_INTERVAL_MS = 7.5;

function toValidBleInterval(ms) {
    return Math.max(BLE_MIN_INTERVAL_MS, Math.round(ms / BLE_INTERVAL_STEP_MS) * BLE_INTERVAL_STEP_MS);
}

function fpsToInterval(fps) {
    return toValidBleInterval(1000 / fps);
}

function intervalToFps(ms) {
    return (1000 / ms).toFixed(1);
}

function resolveTargetInterval({ fps, interval } = {}) {
    if (fps) {
        return fpsToInterval(fps);
    }
    if (interval) {
        return toValidBleInterval(interval);
    }
    return fpsToInterval(60);
}

function clampQueueDepth(depth) {
    const value = Number.isFinite(depth) ? Math.round(depth) : 2;
    return Math.max(1, Math.min(5, value));
}

function printValidFpsOptions() {
    console.log("\n┌─── Valid BLE Intervals (multiples of 1.25ms) ───┐");
    console.log("│                                                  │");
    const targets = [30, 40, 50, 57, 60, 66, 80, 100, 120, 133];
    for (const targetFps of targets) {
        const interval = fpsToInterval(targetFps);
        const actualFps = intervalToFps(interval);
        const marker = targetFps === 60 ? " <-- 60 FPS" : "";
        console.log(`│  --fps=${String(targetFps).padStart(3)} => ${String(interval).padStart(5)}ms (${actualFps.padStart(5)} FPS)${marker}`);
    }
    console.log("│                                                  │");
    console.log("├─── Recommended Presets ─────────────────────────┤");
    console.log("│                                                  │");
    console.log("│  --fps=60  : 16.25ms (61.5 FPS) - Default        │");
    console.log("│  --fps=50  : 20ms    (50.0 FPS) - Conservative   │");
    console.log("│  --fps=66  : 15ms    (66.7 FPS) - Higher refresh │");
    console.log("│  --fps=80  : 12.5ms  (80.0 FPS) - Maximum stable │");
    console.log("│  --fps=40  : 25ms    (40.0 FPS) - Power save     │");
    console.log("│  --fps=15  : 66ms    (14.1 FPS) - Compatibility │");
    console.log("│                                                  │");
    console.log("└──────────────────────────────────────────────────┘\n");
}

module.exports = {
    toValidBleInterval,
    fpsToInterval,
    intervalToFps,
    resolveTargetInterval,
    clampQueueDepth,
    printValidFpsOptions
};
