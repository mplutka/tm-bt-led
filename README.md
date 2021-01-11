# PC Support for Thrustmaster BT LED


## Disclaimer

I bought the device as part of a set and didn't notice before that it was for PS4 only. :-( So I played around with it a bit and discovered that it was basically working as a Bluetooth LE HID over GATT device, spent many many hours figuring out how it works internally and can be communicated with and wrote some horrible code to be able to address all the leds and led segments and to make it display whatever I like.

Combined it with telemetry plugins for F1 2019 and Assetto Corsa/Comp and it is in a state now that I'm happy to share with you. Yes, this is WIP and very yes, this is quite hacky and might crash on your side or don't work at all. **IT MIGHT EVEN DAMAGE YOUR DEVICE** (It shouldn't but don't blame me.)
Feedback is very welcome!

Please note that **I can't provide any specific support** for your environment or setup. I will do my best to document anything special you need to know to make it work.

I hope that I'm not hurting any copyrights or trademarks here. If so please tell me. Just wanted to help out the community. If you like it, feedback and donations are very welcome.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/paypalme/mplutka/5)

**Please don't buy a Thrustmaster BT LED for this only to use at with your PC!** This method works now but could easily break because of future updates etc. I also don't recommend to do any firmware updates on the device if it works as intended.


## Prerequisites

1. You should be familiar with installing and using NodeJS application on Windows command line (cmd.exe).
2. Thrustmaster BT LED ;-) (I won't guarantee that it works on your PC, so keep this in mind when buying one extra for this!)
3. Compatible game (F1 2019/2020 or Assetto Corsa/Comp). F1 2018 might work too. Others might follow.
4. Windows 10 19042 or higher (might work on other but not tested) and the following software:

		a. Git
	
		b. NodeJS [Link](https://nodejs.org/de/download/) (I'm using 14.15.3 LTS)
	
		c. Python3 (get it from Windows Store)
	
		d. Visual Studio 2019 Community with C++ Desktop Development feature enabled for install (!)

5. Zadig [Link](https://zadig.akeo.ie/)
6. USB stick (I'm using a CSR8510 A10 based one which performs very good, my ASUS BT400 didn't work very well) or chipset that provides Bluetooth LE with supported chipset! [List of supported devices](https://github.com/abandonware/node-bluetooth-hci-socket#windows)

7. Windows firewall shouldn't block UPD traffic to 20777 (F1)
  

## Installation

1. Checkout this repo or download the code on your PC on which you intend to run
2. Open a Windows and `cd` inside the code directory
3. Attach your own Thrustmaster BT LED

		a. Determine your TM BT's bluetooth address. Use discover.bat for this and start pairing by pressing both upper buttons an the peripheral while scanning. It should find it and show you the device's address.
		
		b. Inside file 0008d3aabbcc.dump, change "uuid" and "address" at the bottom of the file to match your TM BL address (e.g. 0008d3112233 and 00:08:d3:11:22:33)
		
		c. Rename file 0008d3aabbcc.dump to match your TM BL address (e.g. 0008d3112233.dump)

4.  `npm install` (This should install everything needed. If something fails especially on compilation, check Prerequisites#5)
5. You can try your device and test it's stability by running "test.bat" inside this folder.


## Launch

1. Inside the code dir in the CLI, type `f12019.bat` or `assetto.bat` and hit enter
2. Press both upper buttons on the TM BT and let it connect when prompted to do so. It shouldn't be paired to your PC or other device before doing this!
3. If it is not picking up any devices ("2. Discovering devices" or "1. Starting scan..." never shows up), try restarting the script.
4. It should say "5. Listening for game data..." if all went well. If not also try to unplug and replug the USB stick and start over.
5. Start the game itself and enjoy. For F1 2019 you need to activate and configure telemetry broadcast in the settings (change IP and leave frequency at 60Hz).


## Video

Here is a little video showing the device in action: [Youtube](https://www.youtube.com/watch?v=Bq8g9qwUAUw)
  

## Important notes
 
### Localization

The script tries to read your OS's locale to automatically switch to MPH/F/LB if "en-us" is selected. To can force measurement units by adding "--imperial" or "--metric" after the game batch file (e.g. assetto.bat --metric).

### Bluetooth USB driver

As stated in Prerequisites#5, the Windows Bluetooth driver can't be used because it blocks access to the 0x1812 input service on the device. Therefore an alternate USB driver for your bluetooth device is needed which can be installed with Zadig. WinUSB should be the one to use but you could also try the other ones if you have no success. If scanning or device discovery doesn't start, kill the script with Ctrl+C and start it again. 

**Please note that you loose general bluetooth connectivity in Windows by changing the driver!**
If you need the Windows bluetooth stack for your headset, keyboard, you need an extra stick for this.
  
If you wish to go back to the stock drivers, simply do an automatic driver update in the device manager.

### Instability

Stability has been improved with Version 2.0. After the initial connection the script tries to negotiate a connection interval of 15 ms which should give you a nice 60 Hz refresh rate. If your device freezes or USB errors are thrown in the command line window, try to kill the script and restart the TM BT LED and unplug/plug the usb stick.

If you can't get it to run without crashes, you could add "--interval xxx" after the batch files to try out other refresh intervals (e.g. assetto.bat --interval 125). Please note that the given interval must be a multiple of 1.25 (15, 30, 75, 125). Also try out another USB port on your PC as this might help as well.

### SPECIAL THANKS

Thank you, Dave Cook aka cooknn, for your great support, testing and precious feedback!
