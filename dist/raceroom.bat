@echo off
tm-bt-led.exe --game raceroom %*
if %errorlevel% neq 0 pause
