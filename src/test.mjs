/*
 * Demo script to flash all lights and test the displays
 *
 * Created Date: Wednesday, January 13th 2021, 11:20:51 pm
 * Author: Markus Plutka
 * 
 * Copyright (c) 2021 Markus Plutka
 */

import TmBTLed from "./tmBTLed.mjs";

let revReversed = false;
let revPercent = 0;
let tmbtled;
const start = () => {
    tmbtled.setPerformanceMode();
    setInterval(() => {
        tmbtled.setRpm(Math.floor(Math.random() * 14001));
        tmbtled.setTime(Math.floor(Math.random() * 5001), true);
        tmbtled.setGear(Math.floor(Math.random() * 10));
        if (revReversed) {
            revPercent -= 3;
            if (revPercent < 0) {
                revReversed = !revReversed;
            }
        } else {
            revPercent += 3;
            if (revPercent > 100) {
                revReversed = !revReversed;
            }
        }
        tmbtled.setRevLights(revPercent);
    
        tmbtled.setAllFlashing(true);
    }, 1000 / 60);
}

tmbtled = new TmBTLed(start);
