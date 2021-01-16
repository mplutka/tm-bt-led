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