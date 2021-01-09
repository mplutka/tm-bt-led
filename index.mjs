import TmBTLed from "./tm_bt_led.mjs";

const tmbtled = new TmBTLed();


setInterval(() => {
    tmbtled.setRpm(Math.floor(Math.random() * 101));

    console.log(tmbtled.locale);
}, 1000 / 16);

