const test = require('node:test');
const assert = require('node:assert/strict');
const { LapDeltaTracker } = require('../lib/lapDelta.js');

const TRACK_M = 5000;

// Drives one lap with a pace that varies along the track, so interpolation matters.
// Returns the deltas reported during the lap.
function driveLap(tracker, { lapNum, lapTime, hz = 60, lastLapTime = 0, invalidAt = null, sessionUid = 1n }) {
    const deltas = [];
    const steps = Math.ceil(lapTime * hz);
    for (let step = 0; step <= steps; step++) {
        const time = Math.min(step / hz, lapTime);
        const progress = time / lapTime;
        // Slow first half, fast second half: distance is not linear in time.
        const distance = TRACK_M * (progress < 0.5 ? progress * 0.8 : 0.4 + (progress - 0.5) * 1.2);
        deltas.push(tracker.update({
            lapNum,
            lapDistance: distance,
            currentLapTime: time,
            lastLapTime,
            invalid: invalidAt !== null && progress >= invalidAt,
            sessionUid
        }));
    }
    return deltas;
}

function finishLine(tracker, { lapNum, lastLapTime, sessionUid = 1n }) {
    return tracker.update({ lapNum, lapDistance: 0, currentLapTime: 0, lastLapTime, invalid: false, sessionUid });
}

function midLapDeltas(deltas) {
    return deltas.slice(5, -5);
}

test('no delta on the first lap, delta after one valid lap', () => {
    const tracker = new LapDeltaTracker();
    const first = driveLap(tracker, { lapNum: 1, lapTime: 90 });
    assert.ok(first.every(d => d === null));
    finishLine(tracker, { lapNum: 2, lastLapTime: 90 });
    assert.equal(tracker.bestLapTime, 90);
    const second = driveLap(tracker, { lapNum: 2, lapTime: 90, lastLapTime: 90 });
    assert.ok(midLapDeltas(second).every(d => d !== null));
});

for (const hz of [10, 60]) {
    test(`constant pace offset gives the exact delta at ${hz} Hz`, () => {
        const tracker = new LapDeltaTracker();
        driveLap(tracker, { lapNum: 1, lapTime: 90, hz });
        finishLine(tracker, { lapNum: 2, lastLapTime: 90 });
        // 2 % slower everywhere: delta grows linearly in time, ends at +1.8 s.
        const deltas = driveLap(tracker, { lapNum: 2, lapTime: 91.8, hz, lastLapTime: 90 });
        const last = deltas.filter(d => d !== null).at(-1);
        assert.ok(Math.abs(last - 1.8) < 0.01, `last delta ${last}`);
        deltas.forEach((d, step) => {
            if (d === null) return;
            const expected = Math.min(step / hz, 91.8) * (1 - 90 / 91.8);
            assert.ok(Math.abs(d - expected) < 0.01, `step ${step}: delta ${d}, expected ${expected}`);
        });
    });
}

test('same pace shows zero delta without sampling bias', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 80, hz: 10 });
    finishLine(tracker, { lapNum: 2, lastLapTime: 80 });
    const deltas = midLapDeltas(driveLap(tracker, { lapNum: 2, lapTime: 80, hz: 10, lastLapTime: 80 }));
    for (const d of deltas) {
        assert.ok(Math.abs(d) < 0.005, `delta ${d}`);
    }
});

test('an invalid lap never becomes the reference', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 90 });
    finishLine(tracker, { lapNum: 2, lastLapTime: 90 });
    driveLap(tracker, { lapNum: 2, lapTime: 85, lastLapTime: 90, invalidAt: 0.3 });
    finishLine(tracker, { lapNum: 3, lastLapTime: 85 });
    assert.equal(tracker.bestLapTime, 90);
});

test('the invalid flag of the new lap does not affect the finished lap', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 90 });
    tracker.update({ lapNum: 2, lapDistance: 1, currentLapTime: 0.02, lastLapTime: 90, invalid: true, sessionUid: 1n });
    assert.equal(tracker.bestLapTime, 90);
});

test('a faster valid lap replaces the reference, a slower one does not', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 90 });
    finishLine(tracker, { lapNum: 2, lastLapTime: 90 });
    driveLap(tracker, { lapNum: 2, lapTime: 88, lastLapTime: 90 });
    finishLine(tracker, { lapNum: 3, lastLapTime: 88 });
    assert.equal(tracker.bestLapTime, 88);
    driveLap(tracker, { lapNum: 3, lapTime: 89, lastLapTime: 88 });
    finishLine(tracker, { lapNum: 4, lastLapTime: 89 });
    assert.equal(tracker.bestLapTime, 88);
    const deltas = driveLap(tracker, { lapNum: 4, lapTime: 88, lastLapTime: 89 });
    for (const d of midLapDeltas(deltas)) {
        assert.ok(Math.abs(d) < 0.005, `delta ${d}`);
    }
});

test('best lap time is the official lap time, also when it arrives a packet late', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 90 });
    // Lap number already changed, last lap time not yet updated.
    tracker.update({ lapNum: 2, lapDistance: 0.5, currentLapTime: 0.01, lastLapTime: 0, invalid: false, sessionUid: 1n });
    assert.equal(tracker.bestLapTime, 0);
    tracker.update({ lapNum: 2, lapDistance: 1, currentLapTime: 0.02, lastLapTime: 90.123, invalid: false, sessionUid: 1n });
    assert.equal(tracker.bestLapTime, 90.123);
});

test('a lap recorded from mid-track does not become the reference', () => {
    const tracker = new LapDeltaTracker();
    for (let d = 2000; d <= TRACK_M; d += 50) {
        tracker.update({ lapNum: 1, lapDistance: d, currentLapTime: d / 50, lastLapTime: 0, invalid: false, sessionUid: 1n });
    }
    finishLine(tracker, { lapNum: 2, lastLapTime: 100 });
    assert.equal(tracker.bestLapTime, 0);
});

test('a flashback drops the rewound samples and restores validity', () => {
    const tracker = new LapDeltaTracker();
    const lap = (distance, time, invalid = false) =>
        tracker.update({ lapNum: 1, lapDistance: distance, currentLapTime: time, lastLapTime: 0, invalid, sessionUid: 1n });
    for (let t = 0; t <= 60; t++) lap(t * 50, t);
    lap(3050, 61, true);
    // Rewind to 1000 m, then drive on more slowly but validly.
    for (let t = 20; t <= 100; t++) lap(1000 + (t - 20) * 50, t);
    finishLine(tracker, { lapNum: 2, lastLapTime: 100 });
    assert.equal(tracker.bestLapTime, 100);
    assert.equal(tracker.update({ lapNum: 2, lapDistance: 1500, currentLapTime: 30, lastLapTime: 100, invalid: false, sessionUid: 1n }), 0);
});

test('a session change resets everything', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 90 });
    finishLine(tracker, { lapNum: 2, lastLapTime: 90 });
    assert.equal(tracker.bestLapTime, 90);
    const delta = tracker.update({ lapNum: 1, lapDistance: 100, currentLapTime: 3, lastLapTime: 0, invalid: false, sessionUid: 2n });
    assert.equal(delta, null);
    assert.equal(tracker.bestLapTime, 0);
});

test('no delta before the start line at a race start', () => {
    const tracker = new LapDeltaTracker();
    driveLap(tracker, { lapNum: 1, lapTime: 90 });
    finishLine(tracker, { lapNum: 2, lastLapTime: 90 });
    const delta = tracker.update({ lapNum: 1, lapDistance: -150, currentLapTime: 0, lastLapTime: 0, invalid: false, sessionUid: 1n });
    assert.equal(delta, null);
    assert.equal(tracker.bestLapTime, 0);
});
