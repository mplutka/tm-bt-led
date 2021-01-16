/*
 * Basic client functions
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import TmBTLed from './tmBTLed.mjs';

export default class AbstractClient {
    currentLeftMode = 0;
    currentRightMode = 0;

    client;
    callbacks;

    constructor(gameTitle, leftModes, rightModes) {        
        this.leftModes = leftModes;
        this.rightModes = rightModes;  

        this.gameTitle = gameTitle;
    }

    initTmBtLed = (callbacks) => {
        this.tmBtLed = new TmBTLed(callbacks);
        
        this.tmBtLed.setLeftDisplay(this.gameTitle.substr(0,4).toUpperCase());
        this.tmBtLed.setRightDisplay(this.gameTitle.substr(4,4).toUpperCase());  
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
        this.tmBtLed.flashLeftDisplay(this.leftModes[this.currentLeftMode]);
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
        this.tmBtLed.flashLeftDisplay(this.leftModes[this.currentLeftMode]);
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
        this.tmBtLed.flashRightDisplay(this.rightModes[this.currentRightMode]);
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
        this.tmBtLed.flashRightDisplay(this.rightModes[this.currentRightMode]);
        return this.currentRightMode;    
    }
}