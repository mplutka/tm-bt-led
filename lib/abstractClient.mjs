/*
 * Basic client functions
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

export default class AbstractClient {
    currentLeftMode = 0;
    currentRightMode = 0;

    client;
    callbacks;

    constructor(tmBtLed) {        
        this.setTmBtLed(tmBtLed);
    }

    setCallbacks = callbacks => {
        this.tmBtLed.setCallbacks(callbacks);
    }

    setTmBtLed = (tmBtLed) => {
        this.tmBtLed = tmBtLed;
    }

    startClient = () => {
        // NO op
    }

    stopClient = () => {
        // NO op
    }

    showGameTitle = (title) => {
        this.tmBtLed.setLeftDisplay(title.substr(0,4).toUpperCase());
        this.tmBtLed.setRightDisplay(title.substr(4,4).toUpperCase()); 
    }

    setModes = (leftModes, rightModes) => {
        this.leftModes = leftModes;
        this.rightModes = rightModes; 
    }

    leftPreviousMode = () => {
        if (this.leftModes.length === 0) {
            console.error("No left modes")
            return;
        }
        if (this.currentLeftMode === 0) {
          this.currentLeftMode = this.leftModes.length - 1;
        } else {
          this.currentLeftMode--;
        }
        this.tmBtLed.showTemporaryLeft(this.leftModes[this.currentLeftMode]);
        return this.currentLeftMode;
    }

    leftNextMode = () => {
        if (this.leftModes.length === 0) {
            console.error("No left modes")
            return;
        }
        if (this.currentLeftMode === this.leftModes.length - 1) {
            this.currentLeftMode = 0;
        } else {
            this.currentLeftMode++;
        }
        this.tmBtLed.showTemporaryLeft(this.leftModes[this.currentLeftMode]);
        return this.currentLeftMode;    
    }

    rightPreviousMode = () => {
        if (this.rightModes.length === 0) {
            console.error("No left modes")
            return;
        }
        if (this.currentRightMode === 0) {
            this.currentRightMode = this.rightModes.length - 1;
        } else {
            this.currentRightMode--;
        }
        this.tmBtLed.showTemporaryRight(this.rightModes[this.currentRightMode]);
        return this.currentRightMode;
    }

    rightNextMode = () => {
        if (this.rightModes.length === 0) {
            console.error("No left modes");
            return;
        }
        if (this.currentRightMode === this.rightModes.length - 1) {
            this.currentRightMode = 0;
        } else {
            this.currentRightMode++;
        }
        this.tmBtLed.showTemporaryRight(this.rightModes[this.currentRightMode]);
        return this.currentRightMode;    
    }
}