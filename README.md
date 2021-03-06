# PC Support for Thrustmaster BT LED


## Disclaimer

**I do not work for Thrustmaster and thus this is no official release. It comes with no guarantee or liability for any harm or damage to hardware or software. Use it at your own risk!**

I bought the device as part of a set and didn't notice before that it was for PS4 only. :-( So I played around with it a bit and discovered that it was basically working as a Bluetooth LE HID over GATT device, spent many many hours figuring out how it works internally and can be communicated with and wrote some horrible code to be able to address all the leds and led segments and to make it display whatever I like.

Combined it with telemetry plugins for some games and it is in a state now that I'm happy to share with you. Yes, this is WIP and very yes, this is quite hacky and might crash on your side or don't work at all.

Please note that **I can't provide any specific support** for your environment or setup. I will do my best to document anything special you need to know to make it work.

I hope that I'm not hurting any copyrights or trademarks here. If so please tell me. Just wanted to help out the community. If you like it, feedback and donations are very welcome.

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/paypalme/mplutka/5)

**Please don't buy a Thrustmaster BT LED for this only to use it with your PC!** This method works now but could easily break because of future updates etc. I also don't recommend to do any firmware updates on the device if it works as intended.


## Currently supported games

* F1 2019, F1 2020 (f1.bat)
* Assetto Corsa, Assetto Corsa Competizione (assetto.bat)
* iRacing (iracing.bat)
* Dirt 3, Dirt 4, Dirt Rally, Dirt Rally 2 (dirt.bat)
* Project Cars 2, Project Cars 3, Automobilista 2 (pcars2.bat)
* Forza Motorsport 7, Forza Horizon 4 (forza.bat)
* rFactor2 (rF2.bat)
* Raceroom (raceroom.bat)

If you would like to add a game that uses udp port 20777 to the list, you can use `dump_udp.bat` to create a dumpfile with recorded telemetry data.
Either you use _template.mjs and create your own game file or get in touch with me by creating an issue here on Github and attach the dump.


## Recommended Bluetooth chipsets/sticks known to be working

* CSR 8510 A10 based devices (USB VID: 0x0a12, USB PID: 0x0001)
* Realtek Bluetooth 8761B (USB VID: 0x0bda, USB PID: 0x8771, e.g. MPOW Bluetooth 5.0 stick)
* Intel Wireless Bluetooth 8265 (USB VID: 0x8087, USB PID: 0x0a2b)

Others might work too, but again: No guarantee.

## Prerequisites

1. You should be familiar with installing and using NodeJS application on Windows command line (cmd.exe).
2. Thrustmaster BT LED ;-) (I won't guarantee that it works on your PC, so keep this in mind when buying one extra for this!)
3. Compatible game with enabled telemetry data
4. Windows 10 19042 or higher (might work on other but not tested) and the following software:

	a. [NodeJS](https://nodejs.org/de/download/) (I'm using 14.15.3 LTS)

	For manual installation:
	b. Git
		
	c. Python3 (get it from Windows Store)
	
	d. Visual Studio 2019 Community with C++ Desktop Development feature enabled for install (!)

5. [Zadig](https://zadig.akeo.ie/)
6. USB stick (I'm using a CSR8510 A10 based one which performs very good, my ASUS BT400 didn't work very well) or chipset that provides Bluetooth LE with supported chipset! [List of supported devices](https://github.com/abandonware/node-bluetooth-hci-socket#windows)
  
## Run prebuilt application (recommended)

1. Download version [2.7.3](https://github.com/mplutka/tm-bt-led/releases/download/2.7.3/2.7.3.zip) and extract in empty folder
2. Run `setup.bat` to detect your device and dump it's data to a file for faster reconnects (necessary)
3. (Optional) You can start `test.bat` to run demo mode.
4. Proceed with "Launch" section of this tutorial

## Manual installation

1. Checkout this repo or download the code on your PC on which you intend to run
2. Open a command prompt and `cd` into the code directory
3. `install.bat` (This should install everything needed. If something fails especially on compilation, check Prerequisites#5)
4. Run `setup.bat` to detect your device and dump it's data to a file for faster reconnects (necessary)
5. (Optional) You can start `test.bat` to run demo mode.
6. Proceed with "Launch" section of this tutorial

## Launch

1. Inside the code directory, launch `run.bat` (recommended, see below) or use the provided shortcut batch files.
2. Press both upper buttons on the TM BT and let it connect when prompted to do so. It shouldn't be paired to your PC or other device before doing this!
3. If it is not picking up any devices ("Discovering devices" or "Starting scan..." never shows up), try restarting the script. If still no success, also try to unplug and replug the USB stick and start over.
4. It should say "Waiting for data..." if all went well.
5. Start the game itself and enjoy.


### Auto detect mode

`run.bat` automatically listens for the launch of any supported game, switches to performance mode (higher refresh rates) and steps down to power save mode after you exit the game. Keep it running in the background to automatically switch between supported games without needing to stop/start the shortcut batch files.
If you encounter false detections or any other problems, please let me know.


## Video

Here is a little video showing the device in action: [Youtube](https://www.youtube.com/watch?v=gbmkHltH9ts)
  

## Important notes
 
### Localization

The script tries to read your OS's locale to automatically switch to MPH/F/LB if "en-us" is selected. To can force measurement units by adding `--imperial` or `--metric` after the game batch file (e.g. assetto.bat --metric).

### Bluetooth USB driver

As stated in Prerequisites#5, the Windows Bluetooth driver can't be used because it blocks access to the 0x1812 input service on the device. Therefore an alternate USB driver for your bluetooth device is needed which can be installed with Zadig. WinUSB should be the one to use but you could also try the other ones if you have no success. If scanning or device discovery doesn't start, kill the script with Ctrl+C and start it again. 

**Please note that you loose general bluetooth connectivity in Windows by changing the driver!**
If you need the Windows bluetooth stack for your headset, keyboard, you need an extra stick for this.
  
If you wish to go back to the stock drivers, simply do an automatic driver update in the device manager.

### Instability

Stability has been improved with Version 2.0. After the initial connection the script tries to negotiate a connection interval of 17.5 ms which should give you a nice 60 Hz refresh rate. If your device freezes or USB errors are thrown in the command line window, try to kill the script and restart the TM BT LED and unplug/plug the usb stick.

If you can't get it to run without crashes, you could add `--interval xxx` after the batch files to try out other refresh intervals (e.g. `assetto.bat --interval 50`). Please note that the given interval must be a multiple of 1.25 (15, 30, 50, 125). Also try out another USB port on your PC as this might help as well.

### Network settings for FORZA

Please follow these tutorials and set port to 20127. Also make sure that you disable network isolation (checknetisolation command) as mentioned.
Forza Horizon 4:	https://github.com/zackdevine/FH4RP
Forza Motorsport 7:	https://www.pocketplayground.net/rs-dash-fm7

### Data plugin for rFactor2

Download rF2 Shared Memory Plugin here: http://www.mediafire.com/file/qir5xkb7fqbqa2s/rf2_sm_tools_3.7.14.2.zip/file
Extract and copy "rFactor2SharedMemoryMapPlugin64.dll" into rF2 plugins folder and activate the plugin in the game

### SPECIAL THANKS

Thank you, Dave Cook aka cooknn, for your great support, testing and precious feedback!
