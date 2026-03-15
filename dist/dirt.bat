@echo off
tm-bt-led.exe --game dirt %*
if %errorlevel% neq 0 pause