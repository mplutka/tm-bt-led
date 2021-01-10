import TmBTLed from "./tm_bt_led.mjs";

const tmbtled = new TmBTLed();


setInterval(() => {
    tmbtled.setRpm(Math.floor(Math.random() * 14001));
    tmbtled.setTime(Math.floor(Math.random() * 5001), true);
    tmbtled.setRevLights(Math.floor(Math.random() * 101));
}, 1000 / 60);

