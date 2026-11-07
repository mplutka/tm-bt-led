
# PC Support for Thrustmaster BT LED

**I do not work for Thrustmaster and this is no official release. It comes with no guarantee or liability for any harm or damage to hardware or software. Use it at your own risk!**

I bought the device as part of a set without noticing it was for PS4 only. It turned out to be a Bluetooth LE HID over GATT device, so after many hours of reverse engineering tm-bt-led can drive all its LEDs and segments and feed them with game telemetry. It is hacky and might not work on your setup, and **I can't provide specific support** for your environment.

If I'm hurting any copyrights or trademarks here, please tell me. Feedback and donations are very welcome:
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://paypal.me/mplutka)

**Please don't buy a Thrustmaster BT LED only to use it with your PC!** This works now but could break with future updates. I also don't recommend firmware updates on the device if it works as intended.

**[Download the latest version](https://cju3ax1.short.gy/tm-bt-led)** · Linux (experimental, UDP games only): see [LINUX.md](LINUX.md), the rest of this README describes Windows · [Video](https://www.youtube.com/watch?v=gbmkHltH9ts)

## Supported games

* F1 2019-25 and F1 26 / F1 25 2026 Season Pack (`f1.bat`)
* Assetto Corsa, Assetto Corsa Competizione, Assetto Corsa EVO, Assetto Corsa Rally (`assetto.bat`, Windows only)
* iRacing (`iracing.bat`, Windows only)
* Richard Burns Rally by Rallysimfans (`rbr.bat`)
* Dirt 3, Dirt 4, Dirt Rally, Dirt Rally 2, GRID Legends (`dirt.bat`)
* EA Sports WRC (`wrc.bat`)
* Project Cars 2, Project Cars 3, Automobilista 2 (`pcars2.bat`)
* Forza Motorsport 7, Forza Horizon 4, Forza Horizon 5 (`forza.bat`)
* rFactor 2 (`rF2.bat`, Windows only)
* RaceRoom (`raceroom.bat`, Windows only)
* Euro Truck Simulator 2, American Truck Simulator (`ets2.bat`, Windows only)
* Live for Speed (`lfs.bat`)

To add a game that sends UDP on port 20777, record its telemetry with `dump_udp.bat`. Then either write a client based on `clients/_template.js` or open an issue on GitHub and attach the dump.

## Bluetooth sticks

tm-bt-led drives the Bluetooth stick directly, so it needs a dedicated USB stick with Bluetooth LE. Known to work:

* CSR 8510 A10 (VID 0x0a12, PID 0x0001), including cheap "CSR 4.0" clones, [e.g. this one](https://amzn.to/3Y9a8Li)
* ASUS BT400 (VID 0x0b05, PID 0x17cb)
* Realtek 8761B (VID 0x0bda, PID 0x8771, e.g. MPOW Bluetooth 5.0)
* TP-Link UB500 / UB400 Nano (VID 0x2357, PID 0x0604)
* Intel Wireless Bluetooth 8265 (VID 0x8087, PID 0x0a2b)

Others might work too ([full list](https://github.com/abandonware/node-bluetooth-hci-socket#windows), more can be added in `config.json`, see [Configuration](#configuration)). Some sticks behave better than others, even identical-looking ones. If the link drops often, try another USB port (USB 2.0, or a short extension cable away from USB 3 ports) or a different stick.

## Prerequisites

1. Windows 10 19042 or higher, or Linux (experimental, see [LINUX.md](LINUX.md)). Node.js is only needed when [building from source](#building-from-source).
2. A Thrustmaster BT LED and a supported Bluetooth stick (see above).
3. A supported game with telemetry enabled (see [Game specific settings](#game-specific-settings)).
4. Basic knowledge of the Windows command line.

## Usage

### 1. Download
Download the [current version](https://cju3ax1.short.gy/tm-bt-led) and extract `tmbtled_<version>.zip` into an empty folder.

### 2. Switch the stick to the WinUSB driver (once per stick)
The Windows Bluetooth stack can't be used: the TM BT LED pairs with a well-known debug key that Windows rejects, and Windows denies apps access to the HID service. So the stick is driven directly through Microsoft's WinUSB driver.

1. Plug in the stick and run `install-driver.bat` (or `tm-bt-led.exe --installDriver`).
2. Pick your adapter if several are listed, confirm with `y` and accept the administrator prompt.
3. Wait for "WinUSB installed". If the stick isn't found later, unplug and replug it.

**The stick can no longer be used for other Bluetooth devices in Windows.** Never switch the built-in adapter of a laptop or mainboard you still need. `restore-driver.bat` (or `--restoreDriver`) gives the stick back to Windows. If Windows puts its own driver back, run `install-driver.bat` again.

### 3. Device setup
1. Run `setup.bat` and press both upper buttons on the display. It writes a dump of the device for fast connects (necessary once).
2. Optional: `test.bat` runs a demo.

### 4. Launch
1. Start `run.bat` (auto detect mode, recommended) or one of the game batch files.
2. Press both upper buttons on the display when prompted. It must not be paired to your PC or any other device.
3. Wait for "Waiting for data...", then start the game.

If no device is found, restart the script, and if that doesn't help, unplug and replug the stick.

**Auto detect mode:** `run.bat` waits for any supported game to start, switches to performance mode while it runs and back to power save mode after you exit, so it can stay in the background.

**Reconnects:** if the display turns off or the link drops, tm-bt-led scans again and reconnects automatically. Ctrl+C or closing the console disconnects cleanly. If a game client fails to start, the display shows `ERR` with the game name.

## Command-line options

Run `tm-bt-led.exe --help` for the full list.

| Option | Description |
|--------|-------------|
| `--game=NAME` | Force a game client (`assetto`, `f1`, `iracing`, ...) |
| `--test` / `--setup` | Demo mode / device setup |
| `--installDriver` / `--restoreDriver` | Switch the stick to WinUSB / back to Windows |
| `--fps=N` | Target refresh rate, default 60 (16.25 ms). BLE intervals are multiples of 1.25 ms, `--listFps` shows all valid values |
| `--interval=N` | Target interval in ms instead of `--fps` |
| `--queueDepth=N` | Max pending BLE writes (1-5), default 2 |
| `--legacyTimer` | Use `setInterval` instead of the high-resolution timer |
| `--debug` | Print BLE stats every 2 seconds |
| `--metric` / `--imperial` | Force units (default: from the OS locale) |
| `--message="TEXT"` | Scrolling message while no game is running |
| `--messagelights` | All LEDs on while no game is running |

If the display freezes or stutters, try `--fps=50` or `--fps=40`, `--queueDepth=1`, and `--debug` to see dropped writes or errors.

## Configuration

Settings live in `config.json` next to `tm-bt-led.exe` (see [dist/config.json](dist/config.json) for all options). The `global` section applies to all games, each game section (`f1`, `assetto`, `iracing`, `rF2`, `raceroom`, `ets2`, `dirt`, `wrc`, `forza`, `rbr`, `pcars2`, `lfs`) overrides that game's defaults, e.g. the display modes (`leftModes`, `rightModes`), the UDP `port` and the executables for auto detect mode. Command-line options override `config.json`.

`config.json`, device dumps and `udp_data.txt` are read from and written to the folder of `tm-bt-led.exe`, or the current folder when running from source. The environment variable `TM_BT_LED_HOME` sets a different folder.

**Units:** `en-US`, `en-LR` and `my-MM` use mph/°F/lb, `en-GB` mph with °C/kg, all other locales are metric. Force them with `"metric": true` or `"imperial": true` in `global`.

**Additional Bluetooth sticks:** add VID/PID pairs (decimal or hex) in `global`:
```json
"additionalUsbVidPids": [ { "vid": "0x0bda", "pid": "0x8771" } ]
```

**Output report handle:** frames go to HID report handle 58, the output report of all known devices. With a different layout in the dump, the last writable HID report is used. Force one with `"outputHandle": 58` in `global`.

**UDP forwarding:** UDP games (F1, Dirt, WRC, Forza, RBR, Project Cars 2/AMS2, Live for Speed) can forward their telemetry to other local apps or devices (SimHub, CrewChief, haptics), e.g. `"forwardPorts": [29373]` in the game section. Default ports: 20777 (F1, Dirt, WRC), 20127 (Forza), 6776 (RBR), 5606 (Project Cars 2/AMS2), 30000 (LFS).

**Port conflicts:** if another program already listens on the game's port, the display shows `PORT BUSY` and tm-bt-led keeps running. Close the other program or let one of them forward to the other. Non-F1 UDP clients also accept `"reuseAddr": true`, but Windows then delivers each packet to only one listener.

**Rev light flashing** (Assetto Corsa, WRC, F1, iRacing): the `revLightFlash` object in the game section.
```json
"revLightFlash": {
    "pitLimiterSpeed": "slow",
    "shift": { "style": "off", "speed": "fast" },
    "maxRpm": { "enabled": false, "colors": ["all"], "speed": "fast" }
}
```
* Speeds: `slow` (250 ms per phase), `medium` (125 ms), `fast` (50 ms).
* `pitLimiterSpeed`: full-bar flash with the pit limiter.
* `shift.style`: `off`, `blue_late` (blue flash near the shift point) or `blue_early` (starts earlier).
* `maxRpm`: flash at max RPM. `colors: ["all"]` flashes the whole bar, a list like `["red", "blue"]` only those colour groups. Don't combine a blue `maxRpm` flash with a shift flash, both use the blue LEDs.

**Max RPM for the rev lights** (Assetto Corsa, RBR, LFS, Dirt, WRC): the game's max RPM is used if it reports a plausible value (500-50000), otherwise `fallbackMaxRpm` from the game section (default 7500), otherwise the highest RPM seen so far. The bar never scales below the highest RPM seen.

## Game specific settings

### F1 2019-2026
Enable UDP telemetry in the game (port 20777). All UDP formats from 2018 to 2026 are supported, so use the game's native format (F1 26 / 2026 Season Pack: format **2026**, experimental). Cars built to the 2026 regulations have no DRS; the green rev lights show active aero and Overtake Mode instead (half lit when available, fully lit when active).

### Assetto Corsa, Competizione, EVO, Rally
Uses the game's shared memory, no setup needed. The right-display mode `DISTANCE` (experimental) shows the approximate distance remaining on the lap or stage from the track spline; some tracks or mods report 0 or wrong values. Add it to `rightModesAcc` / `rightModesAssetto` in `config.json`.

### iRacing
No setup needed.

### Forza
* Forza Horizon 5: in "HUD AND GAMEPLAY" enable "DATA OUT", set the IP to 127.0.0.1 and the port to 20127.
* Forza Horizon 4 / Forza Motorsport 7: follow [FH4RP](https://github.com/zackdevine/FH4RP) or [RS Dash FM7](https://www.pocketplayground.net/rs-dash-fm7) with port 20127, including disabling network isolation (`checknetisolation`).

### DiRT, DiRT Rally 1 & 2, GRID Legends
Enable UDP telemetry in `Documents\My Games\<game>\hardwaresettings\hardware_settings_config.xml` by editing the `motion_platform` node [as shown here](https://c4z3q2x8.rocketcdn.me/wp/wp-content/uploads/2020/03/fanaleds_xml_after.jpg). If the rev lights feel wrong for a car, set `fallbackMaxRpm`.

### EA Sports WRC
1. Start the game once so it creates `Documents\My Games\WRC\telemetry\config.json`.
2. Under `udp` → `packets`, add or enable an entry with `"structure": "wrc"`, `"packet": "session_update"`, `"ip": "127.0.0.1"`, `"port": 20777` (must match `wrc.port` in tm-bt-led's `config.json`), `"bEnabled": true` and `"frequencyHz": -1`.
3. Restart the game. If no data arrives, check `telemetry\log.txt`.

Use the standard `wrc` structure, `wrc_experimental` is not supported.

### rFactor 2
Copy `rF2SharedMemory/plugin/rFactor2SharedMemoryMapPlugin64.dll` into the rF2 plugins folder and enable the plugin in the game.

### Euro Truck Simulator 2 / American Truck Simulator
Copy `SCSSharedMemory/plugin/scs-telemetry.dll` into `<GAME_DIR>/bin/win_x64/plugins` (create the folder if needed).

### Live for Speed
In `LFS\cfg.txt` set `OutGauge Mode 1` (or `2` including replays), `OutGauge IP 127.0.0.1` and `OutGauge Port` to the `port` in `config.json` (default 30000). OutGauge is only sent in cockpit view.

## Building from source

Only needed to change the code; the release zip contains everything to run tm-bt-led.

1. Install [Node.js](https://nodejs.org/) 26 or newer, pnpm 10 (`corepack enable`), Python 3 and Visual Studio 2022 or 2026 (Build Tools are enough) with the "Desktop development with C++" workload.
2. `git clone https://github.com/mplutka/tm-bt-led.git`, then `pnpm install`.
3. `pnpm run build` compiles the shared memory addons (Assetto Corsa, rFactor 2, RaceRoom, ETS2/ATS).
4. `pnpm test` and `pnpm run lint` run the unit tests and ESLint.
5. Run from the `dist` folder: `cd dist`, then `node ../lib/launcher.js --help`.
6. `pnpm run pack` builds `dist/tm-bt-led.exe`, which the batch files use, so run it again after code changes. `pnpm run pack:arm64` builds the experimental ARM64 exe and has to run on Windows on ARM.
Releases are built by GitHub Actions when a `v*` tag is pushed, with release notes from the matching `## Version x.y.z` section in [CHANGELOG.md](CHANGELOG.md).

## Special thanks
Thank you, Dave Cook aka cooknn, for your great support, testing and precious feedback!
Also thanks to Calvin from https://clvnhd.com/ for your testing and feedback.
