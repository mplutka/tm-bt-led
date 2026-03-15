@echo off
tm-bt-led.exe --game rF2 %*
if %errorlevel% neq 0 pause
