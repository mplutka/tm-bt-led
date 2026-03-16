@echo off
tm-bt-led.exe --game ets2 %*
if %errorlevel% neq 0 pause
