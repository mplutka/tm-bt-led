## Version 1.0.0

 * Initial version with basic support for F1 2019 and Assetto Corsa

## Version 1.1.0

 * Support for Assetto Corsa Competizione and Assetto Corsa via SharedMemory Access

 ## Version 1.1.5

 * Bugfixes and performance optimizations. Play around with connection interval setting in tm_bt_led.mjs (line 6) to balance between refresh rate and prevention of freezes.

 ## Version 1.1.6

 * New indications for AC/ACC: PitLimiter, EngineRunning, Flags, Delta, CurrentLap, BestLap, LastLap, Watertemp
 * Command line parameters for refresh interval (--interval 125) and conversion to MPH (--mph)
 * Thank you, Dave Cook (cooknn) for your testing, support and input!

## Version 1.1.7

  * Measurement units autodetect by os locale
  * Tyre temperatures for F1

## Version 2.0.0

  * Negotiate new connection update interval after initial connection for much higher refresh rates (down to 7.5ms). Default is 15 ms but may be overriden with --interval parameter and raised to save the device's battery life or prevent crashes.
  * Added "test.bat" for some light show and to test stability. ;-)
  
## Version 2.0.1

  * Support for iRacing

## Version 2.0.3

  * Support for Dirt Rally

## Version 2.1.0

  * Remaining lap distance for Dirt Rally
  * PitLimiter indication for ACC
  * Data dumper for easier game integration (dump_udp.bat). Change listened port with --port xxxxx
  * Easier device dump creation with batch file (setup.bat)
  * Commented template file (_template.bat/.mjs)

## Version 2.1.1

  * Bugfixes for Assetto Corsa (PitLimiter flashing leds, flags, deactivated unavailable modes)
  * install.bat for easier recompilation

## Version 2.1.2

  * Bugfix for ACC right modes

## Version 2.2.0

  * Autodetect running game and switch between power save mode and performance mode. Just run run.bat and keep it running in the background.

## Version 2.2.1

  * General: Reset device between games

## Version 2.3.0

  * F1 2019/2020: Flash red led if lap is invalid
  * F1 2019/2020: Brake temp and ERS storage (if available) on left display
  * F1 2019/2020: Changes to fuel mix, differential & ERS mode mid-race are shown on display

## Version 2.3.1

  * General: Support for longer mode messages. Will scroll if longer than 4 characters

## Version 2.4.0

  * Project Cars 2, Project Cars 3 & Automobilista 2: Added support (use UDP format "Project Cars 2")

## Version 2.5.0

  * Forza Motorsport 7 and Forza Horizon 4: Added support (please see README for network settings)

## Version 2.6.0

  * rFactor2: Added basic support (rFactor2SharedMemoryMapPlugin64.dll needs to be copied to rF2 plugin folder beforehand)

## Version 2.6.1

  * rFactor2: Added some more time and flag data

## Version 2.7.0

  * Raceroom: Added support 
  * General: Added tutorial for use of prebuilt version

## Version 2.7.1

  * F1: Added Delta timings for F1

## Version 2.7.2

  * F1: Realistic DRS indication and rev lights for modern F1 cars

## Version 2.7.3

  * RACEROOM: Bugfix

## Version 2.8.0

  * F1: Added support for F1 2021
  * Euro Truck Simulator 2, American Truck Simulator: Added support

## Version 2.9.0

  * Forza Horizon 5: Added support for Forza Horizon 5

## Version 2.10.0

  * Force metric or imperial units with separate launchers

## Version 3.0.0

  * Introduced new packager. No need to install nodejs anymore. :-)

## Version 3.0.1

  * Euro Truck Simulator 2, American Truck Simulator: Fixed plugin init

## Version 3.0.2

  * Fixed unit conversion

## Version 3.1.0

  * Customization for left and right display with all games

## Version 3.1.1

  * New modes available

## Version 3.1.2

* Fixed bundling

## Version 3.1.3

* Support for shift indication via blue rev lights. Available for F1 and iRacing with config option "blueRevLightsIndicateShift".

## Version 3.1.4

* Support for shift indication via blue rev lights for Assetto. Added run_compat.bat

## Version 3.1.5

* Updated libraries. Fixes for iRacing RPM handling.

## Version 3.1.6

* Added fallback config item for missing MAX RPM data on DiRT3

## Version 3.1.7

* Support for GRID Legends

## Version 3.1.8

* Support for F1 2022, 2023 & 2024

## Version 4.0.0

* Major refactoring and performance improvements
* High-resolution timer and write queue system
* Command-line options for performance tuning
* UDP port forwarding support

## Version 4.1.0

* Support for Assetto Corsa EVO and Assetto Corsa Rally

## Version 4.1.1

* `fallbackMaxRpm` tuning across game configs for consistent RPM bar scaling (`resolveMaxRpm`-style behaviour)
* `assetto.bat`: use `--game=assetto` (replacing deprecated `assetto-sharedmemory`)

## Version 4.1.2

* README and download links aligned with release packaging
* `revLightFlash`: `maxRpm` disabled by default in bundled config for better out-of-the-box performance

## Version 4.2.0

* Fake CSR 4.0–style Bluetooth USB adapters are supported; a low refresh rate is commonly observed with them.

## Version 4.2.1

* Update usb package

## Version 4.3.0

* Added global `config.json` support for `global.additionalUsbVidPids` (array of extra Bluetooth USB VID/PID pairs).
* Updated patched `@abandonware/bluetooth-hci-socket` USB detection to merge built-in adapters with configured additional VID/PID pairs.
* Security fixes

## Version 5.0.0

### New

* No more Zadig: `install-driver.bat` (`tm-bt-led.exe --installDriver`) switches the Bluetooth stick to Microsoft's inbox WinUSB driver, `restore-driver.bat` (`--restoreDriver`) gives it back to Windows
* F1 24, F1 25 and F1 26 / F1 25 2026 Season Pack (2026 UDP format, experimental). Cars built to the 2026 regulations show active aero and Overtake Mode on the green rev lights instead of DRS
* Automatic rescan and reconnect when the device disconnects; clean disconnect on Ctrl+C / console close
* Experimental Windows on ARM build (`tm-bt-led-<version>-arm64.zip`); the native USB binding is selected by CPU architecture
* Experimental Linux support (UDP games only, run from source): the Bluetooth adapter is driven over the HCI user channel, bypassing BlueZ; games are detected from `/proc` (Proton aware); new `global.hciDeviceId` setting. See `LINUX.md`

### Changes

* `config.json` now applies to all games (iRacing, rFactor 2, RaceRoom, ETS2/ATS included); `TM_BT_LED_HOME` overrides the data folder
* Units: `en-GB` uses mph, more imperial locales; `metric`/`imperial` can be set in `config.json`
* Output report handle detected from the device dump, overridable with `global.outputHandle`
* Lower CPU usage: hybrid timer instead of a busy loop, display frame only recomposed when it changed
* Unknown command line arguments now exit with an error and print the list of supported options
* American Truck Simulator is detected in auto mode

### Fixes

* Game client errors no longer crash the program; a busy UDP port shows `PORT BUSY` instead of exiting
* Fixed lap times with milliseconds below 100 (e.g. `1:01.005`) and time spacer handling
* F1: lap times read from the renamed fields of the updated telemetry library
* iRacing: rev lights use the car's shift-light/redline RPM, listeners are no longer registered twice
* Security fixes for vulnerable dependencies (tar, brace-expansion, ip-address, js-yaml, glob, minimatch)

### Build (only relevant when building from source)

* Requires Node.js 26 and pnpm 10, see "Building from source" in the README
* noble's unused WinRT native binding is no longer compiled (fails with Visual Studio 2026); rFactor 2 shared memory addon builds for ARM64
* Unit tests, ESLint, a Linux test job and tagged releases with release notes from this changelog in CI

## Unreleased

### Fixes

* Performance mode was silently ignored when the Bluetooth stick assigned connection handle 0, leaving the display at the slow interval it requested (about 4-7 FPS)
* Faster connect: the redundant GATT service discovery is skipped, all handles come from the device dump
* Performance mode is requested again if the display's own slow-interval request overrides it right after connecting
