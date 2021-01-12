import TmBTLed from "./tm_bt_led.mjs";

const tmbtled = new TmBTLed();


setInterval(() => {
    tmbtled.setRpm(Math.floor(Math.random() * 14001));
    tmbtled.setTime(Math.floor(Math.random() * 5001), true);
    tmbtled.setRevLights(Math.floor(Math.random() * 101));
    tmbtled.setGear(Math.floor(Math.random() * 10));
    tmbtled.setFlashingYellow(true);
    tmbtled.setFlashingBlue(true);
    tmbtled.setFlashingRed(true);
}, 1000 / 60);

