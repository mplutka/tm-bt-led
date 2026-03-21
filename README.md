
# PC Support for Thrustmaster BT LED
## Disclaimer

**I do not work for Thrustmaster and thus this is no official release. It comes with no guarantee or liability for any harm or damage to hardware or software. Use it at your own risk!**
 
I bought the device as part of a set and didn't notice before that it was for PS4 only. :-( So I played around with it a bit and discovered that it was basically working as a Bluetooth LE HID over GATT device, spent many many hours figuring out how it works internally and can be communicated with and wrote some horrible code to be able to address all the leds and led segments and to make it display whatever I like.

Combined it with telemetry plugins for some games and it is in a state now that I'm happy to share with you. Yes, this is WIP and very yes, this is quite hacky and might crash on your side or don't work at all.

Please note that **I can't provide any specific support** for your environment or setup. I will do my best to document anything special you need to know to make it work.

I hope that I'm not hurting any copyrights or trademarks here. If so please tell me. Just wanted to help out the community. If you like it, feedback and donations are very welcome.  

[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/mplutka)

**Please don't buy a Thrustmaster BT LED for this only to use it with your PC!** This method works now but could easily break because of future updates etc. I also don't recommend to do any firmware updates on the device if it works as intended. 

### Latest version
[Download](https://github.com/mplutka/tm-bt-led/releases/download/v4.1.0/4.1.0.zip)

## Currently supported games 

* F1 2019-25 (f1.bat)
* Assetto Corsa, Assetto Corsa Competizione, Assetto Corsa EVO, Assetto Corsa Rally (assetto.bat)
* iRacing (iracing.bat)
* Richard Burns Rally by Rallysimfans (rbr.bat)
* Dirt 3, Dirt 4, Dirt Rally, Dirt Rally 2 (dirt.bat)
* Project Cars 2, Project Cars 3, Automobilista 2 (pcars2.bat)
* Forza Motorsport 7, Forza Horizon 4, Forza Horizon 5 (forza.bat)
* rFactor2 (rF2.bat)
* Raceroom (raceroom.bat)
* Euro Truck Simulator 2, American Truck Simulator (ets2.bat)
* Live for Speed (lfs.bat)

If you would like to add a game that uses udp port 20777 to the list, you can use `dump_udp.bat` to create a dumpfile with recorded telemetry data.

Either you use _template.js and create your own game file or get in touch with me by creating an issue here on Github and attach the dump.
 
## Recommended Bluetooth chipsets/sticks known to be working
* Certain CSR 8510 A10 based devices (USB VID: 0x0a12, USB PID: 0x0001) [This one works fine for me](https://amzn.to/3Y9a8Li)
  * **Warning:** There are many fake "CSR 4.0" dongles on the market. They may show the same USB IDs but are unreliable or do not work with this project. Prefer known-good hardware or one of the alternatives below.
* Realtek Bluetooth 8761B (USB VID: 0x0bda, USB PID: 0x8771, e.g. MPOW Bluetooth 5.0 stick)
* Intel Wireless Bluetooth 8265 (USB VID: 0x8087, USB PID: 0x0a2b)
Others might work too, but again: No guarantee.  

## Prerequisites
1. You should be familiar with installing and using NodeJS application on Windows command line (cmd.exe).
2. Thrustmaster BT LED ;-) (I won't guarantee that it works on your PC, so keep this in mind when buying one extra for this!)
3. Compatible game with enabled telemetry data
4. Windows 10 19042 or higher (might work on other but not tested)
5.  [Zadig](https://zadig.akeo.ie/)
6. USB stick or chipset that provides Bluetooth LE with supported chipset! [List of supported devices](https://github.com/abandonware/node-bluetooth-hci-socket#windows)

## Usage

### Step 1. Install alternate Bluetooth USB driver
As stated in Prerequisites#5, the Windows Bluetooth driver can't be used because it blocks access to the 0x1812 input service on the device. Therefore an alternate USB driver for your bluetooth device is needed which can be installed with Zadig. WinUSB should be the one to use but you could also try the other ones if you have no success. If scanning or device discovery doesn't start, kill the script with Ctrl+C and start it again.

**Please note that you loose general bluetooth connectivity in Windows by changing the driver!**

If you need the Windows bluetooth stack for your headset, keyboard, you need an extra stick for this.
If you wish to go back to the stock drivers, simply do an automatic driver update in the device manager.

### Step 2. Download and setup connector
1. Download current version [here](https://github.com/mplutka/tm-bt-led/releases/download/v4.1.0/4.1.0.zip) and extract the files into an empty folder.
2. Run `setup.bat` to detect your device and write its data to a file for faster reconnects (necessary).
3. (Optional) You can start `test.bat` to run demo mode.

### Step 3. Launch 
1. Launch `run.bat` (recommended, see below) or use the provided game files.
2. Press both upper buttons on the TM BT and let it connect when prompted to do so. It shouldn't be paired to your PC or any other device before doing this!
3. If it is not picking up any devices ("Discovering devices" or "Starting scan..." never shows up), try restarting the script. If still no success, also try to unplug and replug the USB stick and start over.
4. It should say "Waiting for data..." if all went well.
5. Start the game itself and enjoy.

### More on "Auto detect mode"
`run.bat` automatically listens for the launch of any supported game, switches to performance mode (higher refresh rates) and steps down to power save mode after you exit the game. Keep it running in the background to automatically switch between supported games without the need to stop/start the shortcut batch files.

If you encounter false detections or any other problems, please let me know.

## Command-Line Options

Run `tm-bt-led.exe --help` for the full list. Common options:

### Performance Tuning

| Option | Description | Default |
|--------|-------------|---------|
| `--fps=N` | Target FPS (auto-converts to valid BLE interval) | 60 |
| `--interval=N` | Target interval in ms (rounds to nearest valid) | 16.25 |
| `--queueDepth=N` | Max pending BLE writes (1-5, higher = more aggressive) | 2 |
| `--legacyTimer` | Use setInterval instead of high-resolution timer | false |

### Debugging

| Option | Description |
|--------|-------------|
| `--debug` | Show detailed BLE stats every 2 seconds |
| `--listFps` | Show all valid FPS/interval combinations and exit |

### Display Settings

| Option | Description |
|--------|-------------|
| `--metric` | Force metric units (km/h, kg, °C) |
| `--imperial` | Force imperial units (mph, lb, °F) |
| `--message="TEXT"` | Display scrolling message when no game running |
| `--messagelights` | Enable all LEDs when no game running |

### Mode Selection

| Option | Description |
|--------|-------------|
| `--game=NAME` | Force specific game client (assetto, f1, iracing, etc.) |
| `--test` | Run in test/demo mode |
| `--setup` | Run device setup/pairing mode |

### Valid FPS Values

BLE connection intervals must be multiples of 1.25ms. Common presets:

| FPS | Interval | Actual FPS | Notes |
|-----|----------|------------|-------|
| 60 | 16.25ms | 61.5 | Default, smooth gaming |
| 50 | 20ms | 50.0 | Conservative |
| 66 | 15ms | 66.7 | Higher refresh |
| 80 | 12.5ms | 80.0 | Maximum (may be unstable) |
| 40 | 25ms | 40.0 | Power save |
| 15 | 66ms | 14.1 | Compatibility 

Run `--listFps` to see all valid options.

### Examples

```batch
:: Standard 60 FPS mode
tm-bt-led.exe

:: Higher refresh rate with deeper queue
tm-bt-led.exe --fps=80 --queueDepth=3

:: Debug mode to monitor performance
tm-bt-led.exe --debug

:: Conservative mode for stability
tm-bt-led.exe --fps=40 --queueDepth=1

:: Force specific game
tm-bt-led.exe --game=assetto

:: Show help
tm-bt-led.exe --help

:: Show valid FPS options
tm-bt-led.exe --listFps
```

## Customization
You can change the order and type of data displayed on the left and right display (and sometimes the used UDP port) by editing the corresponding 
`xxx.config.js` file in the same folder as `tm-bt-led.exe`.

## UDP Port Forwarding

For UDP-based games (F1, Dirt, Forza, RBR, Project Cars 2/AMS2, Live for Speed), you can forward telemetry data to additional applications or devices. This is useful when you want to use tm-bt-led alongside other telemetry consumers, such as:

- **Software**: SimHub, CrewChief, or other dashboard apps
- **Hardware**: Rumble motors, buttkickers, jet seats, or other haptic feedback devices that receive UDP telemetry

### Configuration

Edit the game's config file (e.g., `f1.config.js`) and add ports to the `forwardPorts` array:

```javascript
const config = {
    port: 20777,                // Port to listen on (game sends UDP here)
    forwardPorts: [29373],      // Forward to SimHub (or any other port)
    // ... other settings
};
```

You can forward to multiple ports:
```javascript
forwardPorts: [29373, 30000],   // Forward to SimHub AND another app
```

### Supported Games

| Game | Default Port | Config File |
|------|-------------|-------------|
| F1 Series | 20777 | f1.config.js |
| Dirt Series | 20777 | dirt.config.js |
| Forza Series | 20127 | forza.config.js |
| Richard Burns Rally | 6776 | rbr.config.js |
| Project Cars 2/AMS2 | 5606 | pcars2.config.js |
| Live for Speed (OutGauge) | 30000 | lfs.config.js |

### Notes

- The original port continues to work normally - data is duplicated to forward ports
- Forward ports are local only (127.0.0.1)
- Leave `forwardPorts: []` empty if you don't need forwarding (default)

## Video

Here is a little video showing the device in action: [Youtube](https://www.youtube.com/watch?v=gbmkHltH9ts)

## Important notes
### Localization

The script tries to read your OS's locale to automatically switch to MPH/F/LB if "en-us" is selected. To can force measurement units by running `run_imperial.bat` or `run_metric.bat` or by adding `--imperial` or `--metric` after the game batch file (e.g. assetto.bat --metric).

### Instability
Stability has been improved with the high-resolution timer and write queue system. The default is 60 FPS (16.25ms interval). If your device freezes or USB errors occur:

1. **Try lower FPS**: `--fps=40` or `--fps=50`
2. **Reduce queue depth**: `--queueDepth=1` (most conservative)
3. **Use debug mode**: `--debug` to monitor for dropped writes or errors
4. **Legacy timer**: `--legacyTimer` if high-res timer causes issues
5. **Restart**: Kill the script, restart the TM BT LED, and unplug/replug the USB stick

The system now includes automatic backoff when USB errors occur, which helps prevent disconnects.

**Note**: BLE intervals must be multiples of 1.25ms. Run `--listFps` to see valid options.

## Game specific settings

### F1 2019-2025
Enable UDP telemetry in the game settings. The telemetry is sent to port 20777 by default.

**Important for F1 25:** You must set the **UDP Format** to **2024** or earlier in the game's telemetry settings. The 2025 format is not yet supported by the telemetry parser.

### Forza Horizon 4 and Forza Motorsport 7
Please follow these tutorials and set port to 20127. Also make sure that you disable network isolation (checknetisolation command) as mentioned.

Forza Horizon 4: https://github.com/zackdevine/FH4RP
Forza Motorsport 7: https://www.pocketplayground.net/rs-dash-fm7

### Forza Horizon 5
Please enable "DATA OUT" in the "HUD AND GAMEPLAY" settings and set "DATA OUT IP ADDRESS" to 127.0.0.1 AND "DATA OUT IP PORT" to 20127.

### DiRT Rally 1 & 2, GRID Legends
Enable UDP telemetry in Documents\My Games\DiRT Rally...\hardwaresettings\hardware_settings_config.xml by editing the motion_platform node as shown here:
https://c4z3q2x8.rocketcdn.me/wp/wp-content/uploads/2020/03/fanaleds_xml_after.jpg

### DiRT 3
UDP telemetry doesn't provide data for max rpm to calculate the current rpm percentage. You need to edit the actual value for your current car (default is 7500) in the custom config file (dirt.config.js).

### rFactor2
Copy "rF2SharedMemory/plugin/rFactor2SharedMemoryMapPlugin64.dll" into rF2 plugins folder and activate the plugin in the game.

### Euro Truck Simulator 2/American Truck Simulator
Copy "SCSSharedMemory/plugin/scs-telemetry.dll" into "<GAME_DIR>/bin/win_x64/plugins". Create the plugins folder if needed.

### Live for Speed
Edit `LFS\cfg.txt` and set **OutGauge** to send to this PC, for example: `OutGauge Mode 1` (or `2` to include replay), `OutGauge IP 127.0.0.1`, and `OutGauge Port` to the same value as in `config.json` / `lfs.config.js` (default **30000**). OutGauge packets are only sent when you are in **cockpit** view. If you set **OutGauge ID** in `cfg.txt`, packets include four extra bytes at the end; the client accepts both sizes.

## SPECIAL THANKS
Thank you, Dave Cook aka cooknn, for your great support, testing and precious feedback!
Also thanks to Calvin from https://clvnhd.com/ for your testing and feedback.
