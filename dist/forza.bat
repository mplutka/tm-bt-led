@echo off
tm-bt-led.exe --game forza %*
if %errorlevel% neq 0 pause
