/*
 * Shared max RPM for rev-light percentage: valid game max (500 < rpm < 50000),
 * else config fallbackMaxRpm if > 0, else learned peak (detectedMaxRpm).
 * Always updates state.detectedMaxRpm from currentRpm; raises max if peak exceeds base.
 *
 * Copyright (c) 2021-2026 Markus Plutka
 */

/**
 * @param {{ telemetryMaxRpm?: number, fallbackMaxRpm?: number, currentRpm?: number }} params
 * @param {{ detectedMaxRpm: number }} state - mutated
 * @returns {number}
 */
function resolveMaxRpmForRevLights(params, state) {
  const currentRpm = params.currentRpm;
  if (typeof currentRpm === 'number' && isFinite(currentRpm) && currentRpm > state.detectedMaxRpm) {
    state.detectedMaxRpm = currentRpm;
  }

  const sm = params.telemetryMaxRpm;
  let maxRpm;
  if (typeof sm === 'number' && isFinite(sm) && sm > 500 && sm < 50000) {
    maxRpm = sm;
  } else {
    const cfgFallback = Number(params.fallbackMaxRpm || 0);
    maxRpm = cfgFallback > 0 ? cfgFallback : state.detectedMaxRpm;
  }

  if (state.detectedMaxRpm > maxRpm) {
    maxRpm = state.detectedMaxRpm;
  }
  return maxRpm;
}

module.exports = { resolveMaxRpmForRevLights };
