@echo off
tm-bt-led.exe --game iracing %*
if %errorlevel% neq 0 pause
