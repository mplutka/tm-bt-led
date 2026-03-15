@echo off
tm-bt-led.exe --test %*
if %errorlevel% neq 0 pause
