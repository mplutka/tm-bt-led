# Linux support (experimental)

tm-bt-led runs on Linux, including the Raspberry Pi, from source. This support is new and has seen little real-world testing, so please report what works and what doesn't in [issue #7](https://github.com/mplutka/tm-bt-led/issues/7).

## How it works
The TM BT LED pairs with a well-known Bluetooth debug key. Like Windows, the Linux kernel rejects that key ("LTK blocked" in `dmesg`), and BlueZ claims the display as a HID gamepad, which hides the HID service tm-bt-led writes to. Pairing through `bluetoothctl` or your desktop's Bluetooth settings therefore doesn't help.

Instead, tm-bt-led takes the Bluetooth adapter over completely through the kernel's HCI user channel and runs its own Bluetooth LE stack, the same one it uses on Windows. While it runs, the adapter is not available to BlueZ or any other application.

Use a dedicated adapter if you need Bluetooth for headsets, keyboards etc. at the same time. Any adapter the Linux kernel supports works (built-in, USB or the Raspberry Pi's on-board one); the USB stick list in the [README](README.md#recommended-bluetooth-chipsetssticks-known-to-be-working) only matters on Windows.

## Supported games
Only games that send telemetry over UDP work on Linux:

* F1 2019-25, F1 26 / F1 25 2026 Season Pack
* DiRT 3, DiRT 4, DiRT Rally 1 & 2, GRID Legends
* EA Sports WRC
* Richard Burns Rally (Rallysimfans)
* Project CARS 2 / 3, Automobilista 2
* Forza Motorsport 7, Forza Horizon 4 / 5
* Live for Speed

Assetto Corsa / ACC / EVO / Rally, iRacing, rFactor 2, RaceRoom and Euro Truck Simulator 2 / American Truck Simulator read Windows shared memory and are Windows only.

The games can run natively, through Steam Proton / Wine on the same machine, or on another PC that sends its telemetry to the Linux machine (for example a Raspberry Pi next to the wheel). Configure the game's telemetry settings as described in the [README](README.md#game-specific-settings); for a remote PC, use the Linux machine's IP address instead of 127.0.0.1.

## Installation
1. Install Node.js 26 or newer, pnpm and a build toolchain. On Debian, Ubuntu and Raspberry Pi OS:
   ```sh
   sudo apt install build-essential python3 git
   ```
   Install Node.js from [nodejs.org](https://nodejs.org) or your distribution, then `corepack enable` (or `npm install -g pnpm`).
2. Get the source and install the dependencies:
   ```sh
   git clone https://github.com/mplutka/tm-bt-led.git
   cd tm-bt-led
   pnpm install
   ```
   `pnpm run build` and `pnpm run pack` are Windows only and not needed.
3. Allow Node.js raw Bluetooth access, so tm-bt-led doesn't need to run as root:
   ```sh
   sudo setcap cap_net_raw,cap_net_admin+eip $(readlink -f $(which node))
   ```
   Repeat this after every Node.js update. Alternatively, run the `node` commands below with `sudo`.

## Usage
All commands are run from the `dist` folder. It holds `config.json` and the device template used by the setup.

1. Hand the adapter over to tm-bt-led:
   ```sh
   sudo btmgmt -i hci0 power off
   ```
   If `btmgmt` isn't available, `sudo systemctl stop bluetooth` works too.
2. If the display was ever paired through BlueZ, remove that pairing (the address starts with `00:08:D3`):
   ```sh
   bluetoothctl remove 00:08:D3:XX:XX:XX
   ```
3. Device setup, once per display:
   ```sh
   cd dist
   node ../lib/launcher.js --setup
   ```
   Press both pair buttons on the display when "Discovering devices" shows up. The setup writes a `.dump` file for the display and exits.
4. Start tm-bt-led:
   ```sh
   node ../lib/launcher.js              # auto detect mode
   node ../lib/launcher.js --game f1    # one specific game
   node ../lib/launcher.js --test       # demo mode
   ```
   All [command-line options](README.md#command-line-options) work as on Windows, except `--installDriver` and `--restoreDriver`, which only print these instructions on Linux.
5. Give the adapter back when you are done:
   ```sh
   sudo btmgmt -i hci0 power on
   ```
   (or `sudo systemctl start bluetooth`).

## Configuration
Everything in `dist/config.json` works as described in the [README](README.md#customization). One setting is Linux only:

| Setting (`global` section) | Default | Description |
|---|---|---|
| `hciDeviceId` | `0` | Adapter to use: `0` = `hci0`, `1` = `hci1`, ... List adapters with `btmgmt info` or `hciconfig`. |

`additionalUsbVidPids` has no effect on Linux.

## Auto detect mode
Running games are detected from `/proc`. Proton and Wine games are recognised by the Windows executable name in their command line (for example `F1_25.exe`), so the `executables` lists in `config.json` work unchanged. A native Linux game whose process name differs can be added to the game's `executables` list.

## Troubleshooting
* **"Startup failed" or permission errors**: the adapter is still powered on in BlueZ (step 1 of Usage), or Node.js lacks the capabilities (step 3 of Installation). Running with `sudo` rules out the latter.
* **"Starting scan..." never shows up**: wrong adapter; check `hciDeviceId`. With several adapters, make sure the one in use is powered off in BlueZ.
* **"Discovering devices" shows up, but the display is never found**: the display may still be paired or connected to another device (your phone, the console, another PC, or BlueZ itself). Remove it there and put it into pairing mode again.
* **No game detected**: run with `--game <name>` to rule out detection, and check the game's telemetry settings.
* **More details**: run with `--debug`.
