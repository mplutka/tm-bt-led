@echo off
tm-bt-led.exe --game assetto %*
if %errorlevel% neq 0 pause
