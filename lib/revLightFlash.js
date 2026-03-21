/*
 * Rev-light flash configuration: speeds, color groups, legacy boolean merge.
 *
 * Modes that do not make sense in practice:
 * - Enabling both legacy blueRevLightsIndicateShift and flashingRevLightsIndicateShift: different
 *   thresholds for the same blue-strip idea; one style wins (late / blueRev).
 * - maxRpm.colors e.g. ["green"] while using the combined setRevLights() bar: that bar is not
 *   split into per-color regions the same way as setRevLightsWithoutBlue; partial colors work
 *   best with the withoutBlue / withoutGreen style clients.
 * - maxRpm flash plus shift blue flash on the same LEDs at the same RPM: both fight over the
 *   blue segment; prefer one or the other.
 */

const SPEED_HALF_MS = {
    slow: 250,
    medium: 125,
    fast: 50,
};

const DEFAULT_PROFILE = {
    pitLimiterSpeed: 'slow',
    shift: { style: 'off', speed: 'fast' },
    maxRpm: { enabled: false, colors: ['all'], speed: 'fast' },
};

let warnedShiftConflict = false;

function halfPeriodMs(speed) {
    const ms = SPEED_HALF_MS[speed];
    return typeof ms === 'number' ? ms : SPEED_HALF_MS.medium;
}

function flashPhaseOn(nowMs, halfMs) {
    return Math.floor(nowMs / halfMs) % 2 === 0;
}

function normalizeColorList(colors) {
    if (!Array.isArray(colors) || colors.length === 0) {
        return ['all'];
    }
    const c = colors.map((x) => String(x).toLowerCase());
    if (c.includes('all')) {
        return ['all'];
    }
    const allowed = new Set(['green', 'red', 'blue']);
    return c.filter((x) => allowed.has(x));
}

function resolveRevLightFlash(config) {
    const profile = {
        pitLimiterSpeed: DEFAULT_PROFILE.pitLimiterSpeed,
        shift: { ...DEFAULT_PROFILE.shift },
        maxRpm: { ...DEFAULT_PROFILE.maxRpm, colors: ['all'] },
    };

    if (!config) {
        profile.maxRpmColorsNormalized = ['all'];
        profile.maxRpmFullBar = true;
        return profile;
    }

    const rf = config.revLightFlash;
    if (rf && typeof rf === 'object') {
        if (rf.pitLimiterSpeed) {
            profile.pitLimiterSpeed = rf.pitLimiterSpeed;
        }
        if (rf.shift && typeof rf.shift === 'object') {
            if (rf.shift.style) {
                profile.shift.style = rf.shift.style;
            }
            if (rf.shift.speed) {
                profile.shift.speed = rf.shift.speed;
            }
        }
        if (rf.maxRpm && typeof rf.maxRpm === 'object') {
            if (typeof rf.maxRpm.enabled === 'boolean') {
                profile.maxRpm.enabled = rf.maxRpm.enabled;
            }
            if (rf.maxRpm.speed) {
                profile.maxRpm.speed = rf.maxRpm.speed;
            }
            if (rf.maxRpm.colors) {
                profile.maxRpm.colors = normalizeColorList(rf.maxRpm.colors);
            }
        }
    }

    const legBlue = !!config.blueRevLightsIndicateShift;
    const legFlash = !!config.flashingRevLightsIndicateShift;
    const legAll = !!config.flashAllLedsAtMaxRpm;

    if (legBlue && legFlash && !warnedShiftConflict) {
        warnedShiftConflict = true;
        console.warn(
            '[revLightFlash] Both blueRevLightsIndicateShift and flashingRevLightsIndicateShift are true. Using the late shift style (same as blue-only). Prefer revLightFlash.shift.style: "blue_late" | "blue_early" only.'
        );
    }

    const structuredShift = rf?.shift?.style;
    if (!structuredShift || structuredShift === 'off') {
        if (legBlue && legFlash) {
            profile.shift.style = 'blue_late';
        } else if (legBlue) {
            profile.shift.style = 'blue_late';
        } else if (legFlash) {
            profile.shift.style = 'blue_early';
        }
    }

    if (!(rf?.maxRpm && typeof rf.maxRpm.enabled === 'boolean')) {
        profile.maxRpm.enabled = profile.maxRpm.enabled || legAll;
    }

    const validShift = new Set(['off', 'blue_late', 'blue_early']);
    if (!validShift.has(profile.shift.style)) {
        profile.shift.style = 'off';
    }

    profile.maxRpmColorsNormalized = normalizeColorList(profile.maxRpm.colors);
    profile.maxRpmFullBar = profile.maxRpmColorsNormalized.includes('all');

    return profile;
}

module.exports = {
    resolveRevLightFlash,
    halfPeriodMs,
    flashPhaseOn,
    SPEED_HALF_MS,
};
