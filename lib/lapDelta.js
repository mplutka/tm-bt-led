/*
 * Live delta to the best valid lap of the session, built from the player's own lap distance and lap time.
 * Used by games that do not send a delta themselves (F1).
 *
 * Created Date: Saturday, November 7th 2026
 * Author: Markus Plutka
 *
 * Copyright (c) 2026 Markus Plutka
 */

// A lap only becomes the reference if its first sample is this close to the start line,
// otherwise the start of the lap was not recorded (e.g. tm-bt-led started mid-lap).
const MAX_START_DISTANCE_M = 250;

function lowerIndex(distances, distance) {
    let lo = 0;
    let hi = distances.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (distances[mid] <= distance) {
            lo = mid;
        } else {
            hi = mid - 1;
        }
    }
    return lo;
}

class LapDeltaTracker {
    bestLapTime = 0;

    constructor() {
        this.reset();
    }

    reset() {
        this.bestLapTime = 0;
        this.sessionUid = null;
        this.lapNum = null;
        this.refDistances = [];
        this.refTimes = [];
        this.pending = null;
        this.lastLapTime = 0;
        this._clearCurrent();
    }

    _clearCurrent() {
        this.distances = [];
        this.times = [];
        this.invalid = false;
    }

    // Returns the delta in seconds (positive = slower than the reference) or null.
    update({ lapNum, lapDistance, currentLapTime, lastLapTime, invalid, sessionUid }) {
        if (sessionUid !== undefined && this.sessionUid !== null && sessionUid !== this.sessionUid) {
            this.reset();
        }
        if (sessionUid !== undefined) {
            this.sessionUid = sessionUid;
        }

        if (lapDistance < 0) {
            if (this.bestLapTime > 0 || this.refDistances.length > 0 || this.distances.length > 0) {
                const uid = this.sessionUid;
                this.reset();
                this.sessionUid = uid;
            }
            this.lapNum = lapNum;
            this.lastLapTime = lastLapTime;
            return null;
        }

        if (this.lapNum !== null && lapNum !== this.lapNum) {
            if (lapNum === this.lapNum + 1) {
                this.pending = {
                    distances: this.distances,
                    times: this.times,
                    invalid: this.invalid,
                    previousLastLapTime: this.lastLapTime
                };
            } else {
                this.pending = null;
            }
            this._clearCurrent();
        }
        this.lapNum = lapNum;
        this.lastLapTime = lastLapTime;

        // The official lap time can arrive a packet after the lap number changed.
        if (this.pending && lastLapTime > 0 && lastLapTime !== this.pending.previousLastLapTime) {
            this._completeLap(this.pending, lastLapTime);
            this.pending = null;
        }

        this._record(lapDistance, currentLapTime, invalid);
        return this._delta(lapDistance, currentLapTime);
    }

    _completeLap(lap, lapTime) {
        if (lap.invalid || lap.distances.length < 2 || lap.distances[0] > MAX_START_DISTANCE_M) {
            return;
        }
        if (this.bestLapTime > 0 && lapTime >= this.bestLapTime) {
            return;
        }
        this.bestLapTime = lapTime;
        this.refDistances = lap.distances;
        this.refTimes = lap.times;
    }

    _record(distance, time, invalid) {
        const count = this.distances.length;
        if (count > 0 && distance < this.distances[count - 1]) {
            // Flashback: drop everything from the rewound section on, validity is restored with it.
            const keep = distance < this.distances[0] ? 0 : lowerIndex(this.distances, distance) + 1;
            this.distances.length = keep;
            this.times.length = keep;
            this.invalid = false;
        }
        if (invalid) {
            this.invalid = true;
        }
        const last = this.distances.length - 1;
        if (last < 0 || distance > this.distances[last]) {
            this.distances.push(distance);
            this.times.push(time);
        }
    }

    _delta(distance, time) {
        const distances = this.refDistances;
        const count = distances.length;
        if (count < 2 || distance < distances[0] || distance > distances[count - 1]) {
            return null;
        }
        const i = Math.min(lowerIndex(distances, distance), count - 2);
        const span = distances[i + 1] - distances[i];
        const ratio = span > 0 ? (distance - distances[i]) / span : 0;
        const refTime = this.refTimes[i] + ratio * (this.refTimes[i + 1] - this.refTimes[i]);
        return time - refTime;
    }
}

module.exports = { LapDeltaTracker };
