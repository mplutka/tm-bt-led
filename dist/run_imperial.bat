@echo off
tm-bt-led.exe --imperial %*
if %errorlevel% neq 0 pause
