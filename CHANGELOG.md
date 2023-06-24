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