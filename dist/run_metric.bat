@echo off
tm-bt-led.exe --metric %*
if %errorlevel% neq 0 pause
