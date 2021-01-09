
  

  

# PC Support for Thrustmaster BT LED

  

  

  

## Disclaimer

  

I bought the device as part of a set and didn't notice before that it was for PS4 only. :-( So I played around with it a bit and discovered that it was basically working as a Bluetooth LE HID over GATT device, spent many many hours figuring out how it works internally and can be communicated with and wrote some horrible code to be able to address all the leds and led segments and to make it display whatever I like.

  

Combined it with telemetry plugins for F1 2019 and Assetto Corsa/Comp and it is in a state now that I'm happy to share with you. Yes, this is WIP and very yes, this is quite hacky and might crash on your side or don't work at all. **IT MIGHT EVEN DAMAGE YOUR DEVICE** (It shouldn't but don't blame me.)

  

  

Feedback is very welcome. Maybe someone can figure out how to make it more stable or whether I'm doing something wrong in general while talking to BLE devices. I'm happy to learn!

  

  

Please note that **I can't provide any specific support** for your environment or setup. I will do my best to document anything special you need to know to make it work.

  

  

I hope (but also don't think) that I'm hurting any copyrights or trademarks here. If so please tell me. Just wanted to help out the community. If you like it, feedback and donations are very welcome.

  

  

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/paypalme/mplutka/5)

  

  

**Please don't by a Thrustmaster BT LED for this only to use at with your PC!** This method works now but could easily break because of future updates etc.

  

  

## Prerequisites

  

1. You should be familiar with installing and using NodeJS application on Windows command line.

  

2. Thrustmaster BT LED ;-) (I won't guarantee that it works on your PC, so keep this in mind when buying one extra for this!)

  

3. Compatible game (F1 2019 or Assetto Corsa/Comp). F1 2018/20 might work too. Others might follow.

  

4. Windows 10 19042 or higher (might work on other but not tested) and the following software:
	a. Git (if you choose to clone the Github repo)
	b. NodeJS [Link](https://nodejs.org/de/download/) (I'm using 14.15.3 LTS)
	c. Python3 (get it from Windows Store)
	d. Visual Studio 2019 Community with C++ Desktop Development feature set enabled


5. Zadig [Link](https://zadig.akeo.ie/)

  

6. USB stick (I'm using a CSR8510 A10 based one, ASUS BT400 didn't work very well) or chipset that provides Bluetooth LE with supported chipset! [List of supported devices](https://github.com/abandonware/node-bluetooth-hci-socket#windows)

  

7. Windows firewall shouldn't block UPD traffic to 20777 (F1)

  

  

## Installation

  

  

1. Checkout this repo or download the code on your PC on which you intend to run

  

2. Open a Windows and `cd` inside the code directory

  

3. Attach your own Thrustmaster BT LED
	a. Determine your TM BT's bluetooth address. Use discover.bat for this and start pairing by pressing both upper buttons an the peripheral while scanning. It should find it and show you the device's address.
	b. Inside file 0008d3aabbcc.dump, change "uuid" and "address" at the bottom of the file to match your TM BL address (e.g. 0008d3112233 and 00:08:d3:11:22:33)
	c. Rename file 0008d3aabbcc.dump to match your TM BL address (e.g. 0008d3112233.dump)

4.  `npm install` (This should install everything needed. If something fails especially on compilation, check Prerequisites#5)

  

  

## Launch

  

1. Inside the code dir in the CLI, type `f12019.bat` or `assetto.bat` and hit enter

  

2. Press both upper buttons on the TM BT and let it connect. It shouldn't be paired to your PC or other device before doing this!

  

3. If it is not picking up any devices ("2. Discovering devices" or "1. Starting scan..." never shows up), try restarting the script.

  

4. It should say "5. Listening for game data..." if all went well. If not also try to unplug and replug the USB stick and start over.

  

5. Start the game itself and enjoy. For F1 2019 you need to activate and configure telemetry broadcast in the settings (change IP and leave frequency at 60Hz).


## Video

Here is a little video showing the device in action: [Youtube](https://www.youtube.com/watch?v=Bq8g9qwUAUw)
  

  

## Important notes

  

  

### Bluetooth USB driver

  

As you should have read in the Prerequisites#5, the Windows Bluetooth driver can't be used because it blocks access to the 0x1812 input service on the device. Therefore an alternate USB driver for your bluetooth device is needed which can be installed with Zadig. WinUSB should be the one to use but you could also try the other ones if you have no success. If scanning or device discovery doesn't start, kill the script with Ctrl+C and start it again. :-)


  

**Please note that you loose general bluetooth support in Windows by changing the driver!**

  

If you wish to go back to the stock drivers, simply do an automatic driver update in the device manager.

  

### Instability

  

The script tries to update the device every 60 ms. If the device requests a longer interval on connection (usually 125 ms) this is taken into account. There is still the possibity that it freezes or something gets stuck. Then just kill the script, restart the TM BT LED and unplug/plug the usb stick. You could add "--interval xxx" after the batch files to try out other refresh intervals. If none of this helps you might consider enabling debug mode in the console by executing `set DEBUG=hci` before starting the actual game script.

### SPECIAL THANKS

Thank you, Dave Cook aka cooknn, for your great support, testing and precious feedback!