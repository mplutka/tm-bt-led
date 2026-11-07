/*
 * Display state of the TM BT Led: segment displays, gear, rev lights and LEDs.
 * Pure logic without any Bluetooth dependency.
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 *
 * Copyright (c) 2021 Markus Plutka
 */

const convert = require('convert-units');
const { resolveRevLightFlash, halfPeriodMs, flashPhaseOn } = require('./revLightFlash.js');

const FRAME_BYTES = 20;
const COLOR_FLASH_HALF_MS = 500;
const GEAR_DOT_FLASH_HALF_MS = { 1: 500, 2: 250 };

const IMPERIAL_LOCALES = new Set(["en-us", "en-lr", "my-mm"]);
const MPH_LOCALES = new Set(["en-gb", ...IMPERIAL_LOCALES]);

function resolveUnits({ metric, imperial, locale } = {}) {
    if (metric) {
        return { speed: "metric", temperature: "metric", weight: "metric", source: "forced metric" };
    }
    if (imperial) {
        return { speed: "imperial", temperature: "imperial", weight: "imperial", source: "forced imperial" };
    }
    const normalized = String(locale || "").toLowerCase();
    const imperialAll = IMPERIAL_LOCALES.has(normalized);
    return {
        speed: MPH_LOCALES.has(normalized) ? "imperial" : "metric",
        temperature: imperialAll ? "imperial" : "metric",
        weight: imperialAll ? "imperial" : "metric",
        source: `locale ${locale || "unknown"}`
    };
}

function packBits(bits, out) {
    out.fill(0);
    for (let i = 0; i < bits.length; i++) {
        if (bits[i]) {
            out[i >> 3] |= 0x80 >> (i & 7);
        }
    }
    return out;
}

function fillFromRight(bits, start, length, count) {
    for (let i = 0; i < length; i++) {
        bits[start + i] = i >= length - count ? 1 : 0;
    }
}

class TmBTLedDisplay {

    static BitRanges = {
        "revLights1":       [8, 15],
        "leftBlue":         [16, 16],
        "revLights2":       [17, 23],
        "leftChar1":        [24, 39],
        "leftChar2":        [40, 55],
        "leftTimeSpacer":   [48, 48],
        "leftChar3":        [56, 71],
        "leftRed":          [64, 64],
        "leftChar4":        [72, 87],
        "leftYellow":       [80, 80],
        "gearDot":          [88, 88],
        "gear":             [89, 95],
        "rightChar1":       [96, 111],
        "rightYellow":      [104, 104],
        "rightChar2":       [112, 127],
        "rightTimeSpacer":  [120, 120],
        "rightChar3":       [128, 143],
        "rightRed":         [136, 136],
        "rightChar4":       [144, 159],
        "rightBlue":        [152, 152],
        "revLightsGreen":   [11, 15],
        "revLightsRed1":    [8, 10],
        "revLightsRed2":    [22, 23],
        "revLightsBlue":    [17, 21],
    };

    // mh mv lo lu u ru ro o   special dot slashlu slashu slashru slashro slasho  slashlo
    // 1  2  3  4  5 6  7  8   1       2       3       4      5       6       7       8
    // https://www.geocachingtoolbox.com/index.php?lang=en&page=segmentDisplay
    static CharMap = {
        " ": "00000000 0000000",
        "0": "00111111 0100100",
        "1": "00000110 0000100",
        "2": "11011011 0000000",
        "3": "10001111 0000000",
        "4": "11100110 0000000",
        "5": "11101101 0000000",
        "6": "11111101 0000000",
        "7": "00000001 0010100",
        "8": "11111111 0000000",
        "9": "11100111 0000000",
        "A": "11110111 0000000",
        "a": "11110111 0000000",
        "B": "10001111 0010010",
        "b": "10001111 0010010",
        "C": "00111001 0000000",
        "c": "00111001 0000000",
        "D": "00001111 0010010",
        "d": "00001111 0010010",
        "E": "01111001 0000000",
        "e": "01111001 0000000",
        "F": "01110001 0000000",
        "f": "01110001 0000000",
        "G": "10111101 0000000",
        "g": "10111101 0000000",
        "H": "11110110 0000000",
        "h": "11110110 0000000",
        "I": "00001001 0010010",
        "i": "00001001 0010010",
        "J": "00011110 0000000",
        "j": "00011110 0000000",
        "K": "01110000 0001100",
        "k": "00000000 0011110",
        "L": "00111000 0000000",
        "l": "00111000 0000000",
        "M": "00110110 0000101",
        "m": "00110110 0000101",
        "N": "00110110 0001001",
        "n": "00110110 0001001",
        "O": "00111111 0000000",
        "o": "00111111 0000000",
        "P": "11110011 0000000",
        "p": "11110011 0000000",
        "Q": "00111111 0001000",
        "q": "00111111 0001000",
        "R": "11110011 0001000",
        "r": "11110011 0001000",
        "S": "10001101 0000001",
        "s": "10001101 0000001",
        "T": "00000001 0010010",
        "t": "00000001 0010010",
        "U": "00111110 0000000",
        "u": "00111110 0000000",
        "V": "00110000 0100100",
        "v": "00110000 0100100",
        "W": "00110110 0101000",
        "w": "00110110 0101000",
        "X": "00000000 0101101",
        "x": "00000000 0101101",
        "Y": "00000000 0010101",
        "y": "00000000 0010101",
        "Z": "00001001 0100100",
        "z": "00001001 0100100",
        "-": "11000000 0000000",
        "+": "11000000 0010010"
    };

    // special:
    // Rev Left Blue
    // L1  MUST SET!
    // L2  Left TimeSpacer
    // L3  Left Red
    // L4  Left Yellow

    // R1  Right Yellow
    // R2  Right Red
    // R3  Right TimeSpacer
    // R4  Right Blue
    static DefaultBits = [
        0, 0, 0, 0, 0, 1, 0, 0, // 0   // 0, Mode: Muss 4 sein
        0, 0, 0, 0, 0, 0, 0, 0, // 8   // 1, RevLights 1.
        0, 0, 0, 0, 0, 0, 0, 0, // 16  // 2, RevLights 2. + Blue left
        0, 0, 0, 0, 0, 0, 0, 0, // 24  // 3, L1
        1, 0, 0, 0, 0, 0, 0, 0, // 32  // 4, Special Bit (muss 1 sein!), L1
        0, 0, 0, 0, 0, 0, 0, 0, // 40  // 5, L2
        0, 0, 0, 0, 0, 0, 0, 0, // 48  // 6, Special Bit, L2
        0, 0, 0, 0, 0, 0, 0, 0, // 56  // 7, L3
        0, 0, 0, 0, 0, 0, 0, 0, // 64  // 8, Special Bit, L3
        0, 0, 0, 0, 0, 0, 0, 0, // 72  // 9, L4
        0, 0, 0, 0, 0, 0, 0, 0, // 80  // 10, Special Bit, L4
        1, 1, 1, 1, 1, 1, 1, 1, // 88  // 11, Gear
        0, 0, 0, 0, 0, 0, 0, 0, // 96  // 12, R1
        0, 0, 0, 0, 0, 0, 0, 0, // 104 // 13, Special Bit, R1
        0, 0, 0, 0, 0, 0, 0, 0, // 112 // 14, R2
        0, 0, 0, 0, 0, 0, 0, 0, // 120 // 15, Special Bit, R2
        0, 0, 0, 0, 0, 0, 0, 0, // 128 // 16, R3
        0, 0, 0, 0, 0, 0, 0, 0, // 136 // 17, Special Bit, R3
        0, 0, 0, 0, 0, 0, 0, 0, // 144 // 18, R4
        0, 0, 0, 0, 0, 0, 0, 0  // 152 // 19, Special Bit, R4
    ];

    message;
    callbacks;
    units;
    metric = true;

    overrideTimerLeftDisplay = null;
    overrideTimerRightDisplay = null;

    isFlashingYellow = false;
    isFlashingBlue = false;
    isFlashingRed = false;
    isFlashingLeftYellow = false;
    isFlashingRightYellow = false;
    isFlashingRightRed = false;

    revLightsFlashing = 0;
    revFlashMaxRpmFullBar = false;
    revLightFlashProfile = null;
    revLightsBlueFlashing = false;
    gearDotFlashing = 0;

    currentLeftButton = null;
    currentRightButton = null;

    bitArray = TmBTLedDisplay.DefaultBits.slice();
    buffer = Buffer.alloc(FRAME_BYTES);
    bufferDirty = true;

    tickerInterval = null;

    showingTemporaryLeft = null;
    delayTemporaryLeftTimeout = null;
    scrollTemporaryLeftInterval = null;

    showingTemporaryRight = null;
    delayTemporaryRightTimeout = null;
    scrollTemporaryRightInterval = null;

    constructor(options = {}) {
        const locale = options.locale || Intl.DateTimeFormat().resolvedOptions().locale;
        this.units = resolveUnits({ metric: options.metric, imperial: options.imperial, locale });
        this.metric = this.units.temperature === "metric";
        if (!options.quiet) {
            console.log(`Units (${this.units.source}): speed ${this.units.speed}, temperature ${this.units.temperature}, weight ${this.units.weight}`);
        }
        this.revLightFlashProfile = resolveRevLightFlash(null);
        this.composeBuffer();
    }

    setCallbacks = callbacks => {
      this.callbacks = callbacks;
    }

    // Read mode button input
    handleEvent = (data) => {
        if (!this.callbacks || !this.callbacks.onLeftPreviousMode || !this.callbacks.onLeftNextMode || !this.callbacks.onRightNextMode || !this.callbacks.onRightPreviousMode) {
            return;
        }
        const leftButton = data[1];
        if (this.currentLeftButton === null) {
          this.currentLeftButton = leftButton;
        }
        if (leftButton !== this.currentLeftButton) {
          if (this.currentLeftButton + 1 === leftButton || (this.currentLeftButton === 255 && leftButton === 0)) {
            this.callbacks.onLeftNextMode();
          } else {
            this.callbacks.onLeftPreviousMode();
          }
          this.currentLeftButton = leftButton;
        }

        const rightButton = data[2];
        if (this.currentRightButton === null) {
          this.currentRightButton = rightButton;
        }
        if (rightButton !== this.currentRightButton) {
          if (this.currentRightButton + 1 === rightButton || (this.currentRightButton === 255 && rightButton === 0)) {
            this.callbacks.onRightNextMode();
          } else {
            this.callbacks.onRightPreviousMode();
          }
          this.currentRightButton = rightButton;
        }
    }

    showTemporary = (message, rightMessage, duration) => {
      this.message = message;
      this.showTemporaryLeft(rightMessage ? this.message : this.message.substring(0, 4).toUpperCase(), duration);
      this.showTemporaryRight(rightMessage ? rightMessage : this.message.substring(4, 8).toUpperCase(), duration);
    }

    showTicker = (message) => {
      this.message = message + " " + message;
      this.clearTickerInterval();

      this.setLeftTimeSpacer(false);
      this.setRightTimeSpacer(false);

      let offset = 0;
      this.setLeftDisplay(this.message.substring(offset, offset + 4));
      this.setRightDisplay(this.message.substring(offset + 4, offset + 8));

      if (message.length <= 8) {
        return;
      }

      this.tickerInterval = setInterval(() => {
        this.setLeftDisplay(this.message.substring(offset, offset + 4));
        this.setRightDisplay(this.message.substring(offset + 4, offset + 8));

        if (offset === message.length) {
          offset = 0;
          this.message = message + " " + message;
        } else {
          offset++;
        }

      }, 500);
    }

    clearTickerInterval = () => {
      if (this.tickerInterval) {
        clearInterval(this.tickerInterval);
        this.tickerInterval = null;
      }
    }

    /**
     * Setter for gear, display, rev lights and leds
     * Will be used by game specific scripts
     * Boolean parameter "right" display data on the right screen
     */

    setGear = gear => {
        let gearCode = "1111111";
        switch(gear) {
          case -1:
            gearCode = "1001100";
            break;
          case 0:
            gearCode = "1001000"; // <- N
            break;
          case 1:
            gearCode = "1111001";
            break;
          case 2:
            gearCode = "0100100";
            break;
          case 3:
            gearCode = "0110000";
            break;
          case 4:
            gearCode = "0011001";
            break;
          case 5:
            gearCode = "0010010";
            break;
          case 6:
            gearCode = "0000011";
            break;
          case 7:
            gearCode = "1111000";
            break;
          case 8:
            gearCode = "0000000";
            break;
          case 9:
            gearCode = "0011000";
            break;
          case null:
            gearCode = "1000000"; // <- 0
            break;
          case undefined:
          case false:
          default:
            gearCode = "1111111";
            break;
        }
        this.setLedSegments("gear", gearCode);
    };

    setNumber = (numberString, right) => {
      let chars = (numberString || "").split("");
      let slots = [];
      for (let i = 0; i < chars.length; i++) {
        if(i < chars.length - 1 && (chars[i + 1] === "." || chars[i + 1] === ",")) {
          slots.push(chars[i] + ".");
          i++;
        } else {
          slots.push(chars[i]);
        }
      }
      while(slots.length < 4) {
        slots.unshift(" ");
      }
      for(let i = 0; i < Math.min(4,slots.length); i++) {
        const splittedChar = (slots[i] || "").split("");
        const char = TmBTLedDisplay.CharMap[splittedChar[0]];
        const withDot = splittedChar.length === 2 && splittedChar[1] === ".";
        this.setLedSegments((right ? "right" : "left") + "Char" + (i + 1), char, withDot);
      }
    };

    setRevLightFlashProfile = (profile) => {
      if (!profile) {
        return;
      }
      this.revLightFlashProfile = profile;
      if (this.revLightsFlashing === 2) {
        this.revFlashMaxRpmFullBar = !!profile.maxRpmFullBar;
      }
    };

    shouldApplyClientRevLights = () => {
      if (this.revLightsFlashing === 1) {
        return false;
      }
      if (this.revLightsFlashing === 2 && this.revFlashMaxRpmFullBar) {
        return false;
      }
      return true;
    };

    needsContinuousRefresh = () => {
      return this.revLightsFlashing >= 1
        || !!this.revLightsBlueFlashing
        || this.gearDotFlashing !== 0
        || this.isFlashingYellow
        || this.isFlashingBlue
        || this.isFlashingRed
        || this.isFlashingLeftYellow
        || this.isFlashingRightYellow
        || this.isFlashingRightRed;
    };

    _writeCombinedRevPercentToWork = (work, percent) => {
      let p = Number(percent);
      if (!Number.isFinite(p) || p < 0) {
        p = 0;
      }
      if (p > 100) {
        p = 100;
      }
      let firstCount = Math.floor((8 / 50) * p);
      let secondCount = 0;
      if (p >= 50) {
        firstCount = 8;
        secondCount = Math.floor((7 / 50) * (p - 50));
      }
      const [firstStart, firstEnd] = TmBTLedDisplay.BitRanges["revLights1"];
      const [secondStart, secondEnd] = TmBTLedDisplay.BitRanges["revLights2"];
      fillFromRight(work, firstStart, firstEnd - firstStart + 1, firstCount);
      fillFromRight(work, secondStart, secondEnd - secondStart + 1, secondCount);
    };

    _clearRevColorGroupInWork = (work, group) => {
      const ranges =
        group === "green"
          ? ["revLightsGreen"]
          : group === "red"
            ? ["revLightsRed1", "revLightsRed2"]
            : group === "blue"
              ? ["revLightsBlue"]
              : [];
      for (const key of ranges) {
        const start = TmBTLedDisplay.BitRanges[key][0];
        const end = TmBTLedDisplay.BitRanges[key][1];
        for (let i = start; i <= end; i++) {
          work[i] = 0;
        }
      }
    };

    _applyShiftBlueFlashToWork = (work, phaseOn) => {
      const start = TmBTLedDisplay.BitRanges["revLightsBlue"][0];
      const end = TmBTLedDisplay.BitRanges["revLightsBlue"][1];
      const v = phaseOn ? 1 : 0;
      for (let i = start; i <= end; i++) {
        work[i] = v;
      }
    };

    _applyRevLightFlashToWork = (work, now) => {
      const prof = this.revLightFlashProfile || resolveRevLightFlash(null);

      if (this.revLightsFlashing === 1) {
        const phase = flashPhaseOn(now, halfPeriodMs(prof.pitLimiterSpeed));
        this._writeCombinedRevPercentToWork(work, phase ? 100 : 0);
        return;
      }

      if (this.revLightsFlashing === 2 && this.revFlashMaxRpmFullBar) {
        const phase = flashPhaseOn(now, halfPeriodMs(prof.maxRpm.speed));
        this._writeCombinedRevPercentToWork(work, phase ? 100 : 0);
        return;
      }

      if (this.revLightsFlashing === 2 && !this.revFlashMaxRpmFullBar) {
        const phase = flashPhaseOn(now, halfPeriodMs(prof.maxRpm.speed));
        const colors = prof.maxRpmColorsNormalized || ["all"];
        if (!phase) {
          for (const c of colors) {
            this._clearRevColorGroupInWork(work, c);
          }
        }
      }

      if (this.revLightsBlueFlashing) {
        const phase = flashPhaseOn(now, halfPeriodMs(prof.shift.speed));
        this._applyShiftBlueFlashToWork(work, phase);
      }
    };

    _applyLedFlashToWork = (work, now) => {
      const phase = flashPhaseOn(now, COLOR_FLASH_HALF_MS) ? 1 : 0;
      const set = (key) => {
        work[TmBTLedDisplay.BitRanges[key][0]] = phase;
      };

      if (this.isFlashingYellow) {
        set("leftYellow");
        set("rightYellow");
      }
      if (this.isFlashingBlue) {
        set("leftBlue");
        set("rightBlue");
      }
      if (this.isFlashingRed) {
        set("leftRed");
        set("rightRed");
      }
      if (this.isFlashingLeftYellow) {
        set("leftYellow");
      }
      if (this.isFlashingRightYellow) {
        set("rightYellow");
      }
      if (this.isFlashingRightRed) {
        set("rightRed");
      }
      if (this.gearDotFlashing) {
        const half = GEAR_DOT_FLASH_HALF_MS[this.gearDotFlashing] || GEAR_DOT_FLASH_HALF_MS[1];
        // gear dot bit is inverted: 0 = on
        work[TmBTLedDisplay.BitRanges["gearDot"][0]] = flashPhaseOn(now, half) ? 0 : 1;
      }
    };

    setRevLightsFlashing = (flashStatus) => {
      if (flashStatus === 0 && this.revLightsFlashing !== 0) {
        this.revLightsFlashing = 0;
        this.revFlashMaxRpmFullBar = false;
        this.setRevLights(0);
        return;
      }
      if (flashStatus == this.revLightsFlashing) {
        return;
      }

      this.revLightsFlashing = flashStatus;
      if (flashStatus === 2) {
        const prof = this.revLightFlashProfile || resolveRevLightFlash(null);
        this.revFlashMaxRpmFullBar = !!prof.maxRpmFullBar;
      } else {
        this.revFlashMaxRpmFullBar = false;
      }
      this.updateBuffer();
    };

    setRevLightsBlueFlashing = (shouldFlash) => {
      if (!shouldFlash) {
        this.revLightsBlueFlashing = false;
        this.setRevLightsBlue(0);
        return;
      }
      if (shouldFlash == this.revLightsBlueFlashing) {
        return;
      }

      this.revLightsBlueFlashing = shouldFlash;
      this.updateBuffer();
    };

    setRevLights = (percent) => {
        this._writeCombinedRevPercentToWork(this.bitArray, percent);
        this.updateBuffer();
    }

    setRevLightsWithoutGreen = (percent, min = 0) => {
        if (percent > 100) {
            percent = 100;
        }

        if (percent < min) {
          percent = 0;
        } else {
          percent = (percent - min) / (100 - min) * 100;
        }

        if (percent < 50) {
          this.setRevLightsRed(Math.floor((5/50) * (percent)));
          this.setRevLightsBlue(0);
        } else if (percent >= 50) {
          this.setRevLightsRed(5);
          this.setRevLightsBlue(Math.floor((5/50) * (percent - 50)));
        } else {
          this.setRevLightsRed(0);
          this.setRevLightsBlue(0);
        }

        this.updateBuffer();
    }

    setRevLightsWithoutBlue = (percent) => {
      if (percent > 100) {
        percent = 100;
      }

      if (percent < 50) {
        this.setRevLightsGreen(Math.floor((5/50) * (percent)));
        this.setRevLightsRed(0);
      } else if (percent >= 50) {
        this.setRevLightsGreen(5);
        this.setRevLightsRed(Math.floor((5/50) * (percent - 50)));
      } else {
        this.setRevLightsGreen(0);
        this.setRevLightsRed(0);
      }

      this.updateBuffer();
    }

    setRevLightsGreen = (num = 0) => {
      const firstBitStart = TmBTLedDisplay.BitRanges["revLightsGreen"][0];
      const firstBitEnd = TmBTLedDisplay.BitRanges["revLightsGreen"][1];
      for (let i = firstBitEnd; i >= firstBitStart; i--) {
        if ((firstBitEnd - i - num + 1) <= 0) {
          this.bitArray[i] = 1;
        } else {
          this.bitArray[i] = 0;
        }
      }

      this.updateBuffer();
    }

    setRevLightsRed = (num = 0) => {
      const firstBitStart = TmBTLedDisplay.BitRanges["revLightsRed1"][0];
      const firstBitEnd = TmBTLedDisplay.BitRanges["revLightsRed1"][1];
      const secondBitStart = TmBTLedDisplay.BitRanges["revLightsRed2"][0];
      const secondBitEnd = TmBTLedDisplay.BitRanges["revLightsRed2"][1];
      for (let i = firstBitEnd; i >= firstBitStart; i--) {
        if ((firstBitEnd - i + 1 - num) <= 0) {
          this.bitArray[i] = 1;
        } else {
          this.bitArray[i] = 0;
        }
      }
      for (let i = secondBitEnd; i >= secondBitStart; i--) {
          if ((secondBitEnd - i - num + (firstBitEnd - firstBitStart + 1) + 1) <= 0) {
            this.bitArray[i] = 1;
          } else {
            this.bitArray[i] = 0;
          }
      }

      this.updateBuffer();
    }

    setRevLightsBlue = (num = 0) => {
      const firstBitStart = TmBTLedDisplay.BitRanges["revLightsBlue"][0];
      const firstBitEnd = TmBTLedDisplay.BitRanges["revLightsBlue"][1];
      for (let i = firstBitEnd; i >= firstBitStart; i--) {
        if ((firstBitEnd - i - num + 1) <= 0) {
          this.bitArray[i] = 1;
        } else {
          this.bitArray[i] = 0;
        }
      }

      this.updateBuffer();
    }

    setTemperature = (value, right) => { // expects C
      if (value < 0) {
        value = 0;
      }

      if (this.units.temperature === "imperial") {
        value = convert(value).from("C").to("F");
      }

      if (value >= 1000) {
        value = value.toFixed(0);
      } else {
        value = value.toFixed(1);
      }

      this.updateDisplay(value, right);
    }

    setWeight = (value, right) => { // expects kg
      if (value < 0) {
        value = 0;
      }

      if (this.units.weight === "imperial") {
        value = convert(value).from("kg").to("lb").toFixed(1);
      } else {
        value = value.toFixed(1);
      }

      this.updateDisplay(value, right);
    }

    setFloat = (value, right) => {
        if (value < 0) {
          value = 0;
        }
        value = value.toFixed(1);
        this.updateDisplay(value, right);
    }

    setInt = (value, right) => {
      value = parseInt(value);
      if (value < 0) {
        value = 0;
      }
      value = value.toFixed(0);
      this.updateDisplay(value, right);
    }

    setSpeed = (value, right) => { // expects Kmh
      value = parseInt(value);
      if (value < 0) {
        value = 0;
      }
      if (this.units.speed === "imperial") {
        value = convert(value).from("km/h").to("m/h").toFixed(0);
      } else {
        value = value.toFixed(0);
      }
      this.updateDisplay(value, right);
    }

    setRpm = (rpm, right) => {
        if (rpm < 0) {
          rpm = 0;
        }

        if (rpm >= 10000) {
          rpm = (rpm / 1000).toFixed(1) + "K";
        } else {
          rpm = rpm.toFixed(0);
        }
        this.updateDisplay(rpm, right);
    }

    _hasNoOverride = (right) => {
      return (right && this.overrideTimerRightDisplay === null) || (!right && this.overrideTimerLeftDisplay === null);
    }

    setDiffTime = (time, right) => {
      let timeString = "----";
      if (time === null || isNaN(time) || time >= 2147483647) {
        this.updateDisplay(timeString, right);
        if (this._hasNoOverride(right)) {
          this.setTimeSpacer(true, right);
        }
        return;
      }

      const isNegative = time < 0;
      time = Math.abs(time) / 1000;

      if (time > 99.99) {
        timeString = "99.9";
      } else if (time < 10) {
        timeString = time.toFixed(2);
      } else {
        timeString = time.toFixed(1);
      }

      if (isNegative) {
        timeString = "-" + timeString;
      } else {
        timeString = "+" + timeString;
      }
      this.updateDisplay(timeString, right);
    };

    setTime = (time, right) => { // time in Milliseconds
      let timeString = "----";
      if (time === 0 || time === null || isNaN(time) || time >= 2147483647) {
        this.updateDisplay(timeString, right);
        if (this._hasNoOverride(right)) {
          this.setTimeSpacer(true, right);
        }
        return;
      }

      this.setTimeSpacer(false, right);
      let timeInSeconds = Math.abs(time) / 1000;
      let minutes = Math.floor(timeInSeconds / 60).toFixed(0);
      let seconds = Math.floor(timeInSeconds % 60).toFixed(0);
      while (seconds.length < 2) {
        seconds = "0" + seconds;
      }

      const milliseconds = String(Math.floor(Math.abs(time) % 1000)).padStart(3, "0");

      if (timeInSeconds === 0) {
        timeString = "0.000";
      }
      if (parseInt(minutes) > 99) {
        timeString = "9999";
        if (this._hasNoOverride(right)) {
          this.setTimeSpacer(true, right);
        }
      } else if (timeInSeconds < 10) {
        timeString = "" + timeInSeconds;
        while (timeString.length < 5) {
          timeString = timeString + "0";
        }
      } else if (parseInt(minutes) < 1) {
        timeString = seconds + "." + milliseconds.substring(0,2);
      } else if (parseInt(minutes) < 10) {
        timeString = minutes + "." + seconds + "." + milliseconds.substring(0,1);
      } else {
        timeString = minutes + seconds;
        if (this._hasNoOverride(right)) {
          this.setTimeSpacer(true, right);
        }
      }

      this.updateDisplay(timeString, right);
    }

    // Manipulation of bit array which holds the current state of all leds and led segment displays
    updateBuffer = () => {
        this.bufferDirty = true;
    };

    composeBuffer = (now = Date.now()) => {
        const work = this.bitArray.slice();
        this._applyRevLightFlashToWork(work, now);
        this._applyLedFlashToWork(work, now);
        packBits(work, this.buffer);
        this.bufferDirty = false;
        return this.buffer;
    };

    getFrame = (now = Date.now()) => {
        if (this.bufferDirty || this.needsContinuousRefresh()) {
          return this.composeBuffer(now);
        }
        return this.buffer;
    };

    resetBuffer = () => {
        this.bitArray = TmBTLedDisplay.DefaultBits.slice();
        this.updateBuffer();
    }

    reset = () => {
      this.setAllColors(false);
      this.setAllFlashing(false);
      this.setFlashingLeftYellow(false);
      this.setFlashingRightYellow(false);
      this.setFlashingRightRed(false);
      this.setRevLights(0);
      this.setRevLightsFlashing(0);
      this.setRevLightsBlueFlashing(false);
      this.setGearDotFlashing(0);
      this.resetBuffer();
      this.clearTickerInterval();
    }

    dispose = () => {
      this.clearTickerInterval();
      this.clearTemporaryLeftTimers();
      this.clearTemporaryRightTimers();
    }

    flipBit = (bit) => {
      this.bitArray[bit] = this.bitArray[bit] === 1 ? 0 : 1;
      this.updateBuffer();
    }

    setBit = (bit, on, inverted) => {
      this.bitArray[bit] = on ? (inverted ? 0 : 1) : (inverted ? 1 : 0);
      this.updateBuffer();
    }

    setLedSegments = (type, bitString, withDot) => {
        let bits = (bitString || "").split("");
        const bitStart = TmBTLedDisplay.BitRanges[type][0];
        const bitEnd = TmBTLedDisplay.BitRanges[type][1] + 1;

        // Prevent overflow
        bits = bits.slice(0, bitEnd - bitStart);
        for(let i = 0; i < bits.length; i++) {
          if (bits[i] === " ") {
            // Skip this bit
            continue;
          }
          this.bitArray[bitStart + i] = parseInt(bits[i]);
        }
        if (bits.length > 9) {
          this.bitArray[bitStart + 9] = withDot ? 1 : 0;
        }
        this.updateBuffer();
    };

    setLeftDisplay = str => {
      str = String(str);
      while(str.length < 4) {
        str = " " + str;
      }

      str.split("").slice(0,4).forEach((c, i) => {
        this.setLedSegments("leftChar" + (i + 1), TmBTLedDisplay.CharMap[c], false);
      });
    }

    showTemporaryLeft = (str, duration) => {
      duration = duration || 3000;

      if (str === this.showingTemporaryLeft) {
        return;
      }
      this.showingTemporaryLeft = str;
      this.clearTemporaryLeftTimers();

      this.setLeftTimeSpacer(false);

      this.setLeftDisplay(str);

      if (str.length > 4 && str.substring) {
        let offset = 1;
        this.delayTemporaryLeftTimeout = setTimeout(() => {
          this.scrollTemporaryLeftInterval = setInterval(() => {
            if (offset >= str.length - 3) {
              clearInterval(this.scrollTemporaryLeftInterval);
              this.scrollTemporaryLeftInterval = null;
              return;
            }
            this.setLeftDisplay(str.substring(offset++));
          }, 200);
        }, 500);
      }

      this.overrideTimerLeftDisplay = setTimeout(() => {
        this.overrideTimerLeftDisplay = null;
        this.showingTemporaryLeft = null;
        this.clearTemporaryLeftTimers();
      }, duration);
    }

    clearTemporaryLeftTimers = () => {
      if (this.overrideTimerLeftDisplay !== null) {
        clearTimeout(this.overrideTimerLeftDisplay);
        this.overrideTimerLeftDisplay = null;
      }
      if (this.scrollTemporaryLeftInterval) {
        clearInterval(this.scrollTemporaryLeftInterval);
        this.scrollTemporaryLeftInterval = null;
      }
      if (this.delayTemporaryLeftTimeout) {
        clearTimeout(this.delayTemporaryLeftTimeout);
        this.delayTemporaryLeftTimeout = null;
      }
    }

    updateLeftDisplay = (str) => {
      if (this.overrideTimerLeftDisplay !== null) {
        return;
      }
      if(str.match(/[\.\d]/)) {
        this.setNumber(str, false);
      } else {
        this.setLeftDisplay(str);
      }
    }

    setRightDisplay = str => {
      str = String(str);
      while(str.length < 4) {
        str = " " + str;
      }

      str.split("").slice(0,4).forEach((c, i) => {
        this.setLedSegments("rightChar" + (i + 1), TmBTLedDisplay.CharMap[c], false);
      })
    }

    showTemporaryRight = (str, duration) => {
      duration = duration || 3000;

      if (str === this.showingTemporaryRight) {
        return;
      }
      this.showingTemporaryRight = str;
      this.clearTemporaryRightTimers();

      this.setRightTimeSpacer(false);

      this.setRightDisplay(str);

      if (str.length > 4 && str.substring) {
        let offset = 1;
        this.delayTemporaryRightTimeout = setTimeout(() => {
          this.scrollTemporaryRightInterval = setInterval(() => {
            if (offset >= str.length - 3) {
              clearInterval(this.scrollTemporaryRightInterval);
              this.scrollTemporaryRightInterval = null;
              return;
            }
            this.setRightDisplay(str.substring(offset++));
          }, 200);
        }, 500);
      }

      this.overrideTimerRightDisplay = setTimeout(() => {
        this.overrideTimerRightDisplay = null;
        this.showingTemporaryRight = null;
        this.clearTemporaryRightTimers();
      }, duration);
    }

    clearTemporaryRightTimers = () => {
      if (this.overrideTimerRightDisplay !== null) {
        clearTimeout(this.overrideTimerRightDisplay);
        this.overrideTimerRightDisplay = null;
      }
      if (this.scrollTemporaryRightInterval) {
        clearInterval(this.scrollTemporaryRightInterval);
        this.scrollTemporaryRightInterval = null;
      }
      if (this.delayTemporaryRightTimeout) {
        clearTimeout(this.delayTemporaryRightTimeout);
        this.delayTemporaryRightTimeout = null;
      }
    }

    updateRightDisplay = (str) => {
      if (this.overrideTimerRightDisplay !== null) {
        return;
      }

      if(str.match(/[\.\d]+/) !== null) {
        this.setNumber(str, true);
      } else {
        this.setRightDisplay(str);
      }
    }

    updateDisplay = (str, right) => {
      if (right) {
        this.updateRightDisplay(str);
      } else {
        this.updateLeftDisplay(str);
      }
    };

    setLeftChar1 = char => {
      this.setLedSegments("leftChar1", TmBTLedDisplay.CharMap[char]);
    };

    setLeftChar2 = char => {
      this.setLedSegments("leftChar2", TmBTLedDisplay.CharMap[char]);
    };

    setLeftChar3 = char => {
      this.setLedSegments("leftChar3", TmBTLedDisplay.CharMap[char]);
    };

    setLeftChar4 = char => {
      this.setLedSegments("leftChar4", TmBTLedDisplay.CharMap[char]);
    };

    setRightChar1 = char => {
      this.setLedSegments("rightChar1", TmBTLedDisplay.CharMap[char]);
    };

    setRightChar2 = char => {
      this.setLedSegments("rightChar2", TmBTLedDisplay.CharMap[char]);
    };

    setRightChar3 = char => {
      this.setLedSegments("rightChar3", TmBTLedDisplay.CharMap[char]);
    };

    setRightChar4 = char => {
      this.setLedSegments("rightChar4", TmBTLedDisplay.CharMap[char]);
    };

    setGearDot = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["gearDot"][0], on, true);
    };

    setGearDotFlashing = (flashStatus) => {
      if (!flashStatus) {
        if (this.gearDotFlashing !== 0) {
          this.gearDotFlashing = 0;
          this.setGearDot(false);
        }
        return;
      }
      if (flashStatus == this.gearDotFlashing) {
        return;
      }
      this.gearDotFlashing = flashStatus;
      this.updateBuffer();
    };

    toggleGearDot = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["gearDot"][0]);
    };

    setLeftTimeSpacer = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftTimeSpacer"][0], on);
    }

    toggleLeftTimeSpacer = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftTimeSpacer"][0]);
    };

    setRightTimeSpacer = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["rightTimeSpacer"][0], on);
    }

    setTimeSpacer = (on, right) => {
      if (right) {
        this.setRightTimeSpacer(on);
      } else {
        this.setLeftTimeSpacer(on);
      }
    }

    toggleRightTimeSpacer = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["rightTimeSpacer"][0]);
    };

    setLeftBlue = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftBlue"][0], on);
    }

    toggleLeftBlue = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftBlue"][0]);
    };

    setRightBlue = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["rightBlue"][0], on);
    }

    toggleRightBlue = () => {
        this.flipBit(TmBTLedDisplay.BitRanges["rightBlue"][0]);
    };

    setBlue = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftBlue"][0], on)
      this.setBit(TmBTLedDisplay.BitRanges["rightBlue"][0], on)
    };

    toggleBlue = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftBlue"][0]);
      this.flipBit(TmBTLedDisplay.BitRanges["rightBlue"][0]);
    };

    setLeftRed = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftRed"][0], on);
    }

    toggleLeftRed = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftRed"][0]);
    };

    setRightRed = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["rightRed"][0], on);
    }

    toggleRightRed = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["rightRed"][0]);
    };

    setRed = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftRed"][0], on)
      this.setBit(TmBTLedDisplay.BitRanges["rightRed"][0], on)
    };

    toggleRed = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftRed"][0]);
      this.flipBit(TmBTLedDisplay.BitRanges["rightRed"][0]);
    };

    setLeftYellow = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftYellow"][0], on);
    }

    toggleLeftYellow = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftYellow"][0]);
    };

    setRightYellow = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["rightYellow"][0], on);
    }

    toggleRightYellow = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["rightYellow"][0]);
    };

    setYellow = (on) => {
      this.setBit(TmBTLedDisplay.BitRanges["leftYellow"][0], on)
      this.setBit(TmBTLedDisplay.BitRanges["rightYellow"][0], on)
    };

    toggleYellow = () => {
      this.flipBit(TmBTLedDisplay.BitRanges["leftYellow"][0]);
      this.flipBit(TmBTLedDisplay.BitRanges["rightYellow"][0]);
    };

    _setFlashing = (flag, shouldFlash, setLed) => {
      if (!shouldFlash) {
        this[flag] = false;
        setLed(false);
        return;
      }
      if (this[flag]) {
        return;
      }
      this[flag] = true;
      this.updateBuffer();
    }

    setFlashingYellow = (shouldFlash) => this._setFlashing("isFlashingYellow", shouldFlash, this.setYellow);
    setFlashingBlue = (shouldFlash) => this._setFlashing("isFlashingBlue", shouldFlash, this.setBlue);
    setFlashingRed = (shouldFlash) => this._setFlashing("isFlashingRed", shouldFlash, this.setRed);
    setFlashingLeftYellow = (shouldFlash) => this._setFlashing("isFlashingLeftYellow", shouldFlash, this.setLeftYellow);
    setFlashingRightYellow = (shouldFlash) => this._setFlashing("isFlashingRightYellow", shouldFlash, this.setRightYellow);
    setFlashingRightRed = (shouldFlash) => this._setFlashing("isFlashingRightRed", shouldFlash, this.setRightRed);

    setAllFlashing = (shouldFlash) => {
        this.setFlashingBlue(shouldFlash);
        this.setFlashingYellow(shouldFlash);
        this.setFlashingRed(shouldFlash);
    }

    setAllColors = (on) => {
        this.setBlue(on);
        this.setRed(on);
        this.setYellow(on);
    }

    toggleAllColors = () => {
        this.toggleBlue();
        this.toggleRed();
        this.toggleYellow();
    }
}

module.exports = {
    TmBTLedDisplay,
    resolveUnits,
    packBits,
    FRAME_BYTES
};
