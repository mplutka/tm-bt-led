@echo off
tm-bt-led.exe --game projectcars2 %*
if %errorlevel% neq 0 pause
