@echo off
tm-bt-led.exe --game rbr %*
if %errorlevel% neq 0 pause
