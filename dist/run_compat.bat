@echo off
tm-bt-led.exe --interval 50 %*
if %errorlevel% neq 0 pause